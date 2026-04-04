from fastapi import FastAPI, Depends, HTTPException, status, Form, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import timedelta
import os
import shutil

import models, schemas, crud, auth
from database import engine, get_db
from ml.inference import is_cyberbullying_text, is_cyberbullying_image

# Create Database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cyberbullying Detection API")

# Setup static files and uploads
STATIC_DIR = "static"
UPLOAD_DIR = "static/uploads"
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app.mount("/static", StaticFiles(directory="static"), name="static")

# -----------------
# API: Auth Routes
# -----------------
@app.post("/api/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # First user is admin just for demo logic
    is_first = db.query(models.User).count() == 0
    created = crud.create_user(db=db, user=user)
    if is_first:
        created.role = 'admin'
        db.commit()
    return created

@app.post("/api/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    # Check block
    if user.is_blocked:
        import datetime
        if user.block_expires_at and datetime.datetime.utcnow() > user.block_expires_at:
            user.is_blocked = False
            user.block_expires_at = None
            db.commit()
        else:
            raise HTTPException(status_code=403, detail=f"Account blocked until {user.block_expires_at}")
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "role": user.role}

# -----------------
# API: Cyberbullying Features
# -----------------
@app.post("/api/posts")
def create_post(description: str = Form(""), is_meme: str = Form("false"), file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)

    # ML Image Check (Only run on Memes)
    if is_meme.lower() == 'true':
        is_toxic = is_cyberbullying_image(file_location)
        if is_toxic:
            os.remove(file_location) # discard immediately
            crud.add_strike(db, current_user.id, reason="image: hate meme detected")
            raise HTTPException(status_code=400, detail="Cyberbullying image detected. Post blocked and strike added.")
        
    post = schemas.PostCreate(description=description, image_path=f"/static/uploads/{file.filename}")
    return crud.create_post(db=db, post=post, user_id=current_user.id)

@app.get("/api/posts")
def get_posts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    posts = crud.get_posts(db, skip=skip, limit=limit)
    response = []
    for p in posts:
        # include basic comment info
        p_dict = {
            "id": p.id,
            "user_id": p.user_id,
            "username": p.owner.username,
            "image_path": p.image_path,
            "description": p.description,
            "likes": [l.user_id for l in getattr(p, 'likes', [])],
            "comments": [{"id": c.id, "username": c.owner.username, "content": c.content} for c in p.comments if not c.is_cyberbullying]
        }
        response.append(p_dict)
    return response

@app.post("/api/posts/{post_id}/like")
def toggle_like(post_id: int, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    status_liked = crud.toggle_like(db, post_id, current_user.id)
    return {"liked": status_liked}

@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id, models.Post.user_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or not yours")
    db.delete(post)
    db.commit()
    return {"message": "Deleted"}

@app.post("/api/posts/{post_id}/comments")
def add_comment(post_id: int, comment: schemas.CommentBase, current_user: models.User = Depends(auth.get_current_active_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    # ML Text Check
    is_toxic = is_cyberbullying_text(comment.content)
    if is_toxic:
        c = schemas.CommentCreate(content=comment.content, post_id=post_id)
        crud.create_comment(db, c, current_user.id, is_cyberbullying=True)
        crud.add_strike(db, current_user.id, reason="text: cyberbullying comment detected")
        raise HTTPException(status_code=400, detail="Cyberbullying text detected. Comment blocked and strike added.")
        
    c = schemas.CommentCreate(content=comment.content, post_id=post_id)
    return crud.create_comment(db, c, current_user.id, is_cyberbullying=False)

@app.get("/api/profile/stats")
def get_profile_stats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    # Percentage logic mapping: 100 cyberbullying comments received by user = 100% Hate Measure
    # This means user finds out how many cyberbullying comments they GOT
    user_posts_ids = [p.id for p in current_user.posts]
    toxic_comments_received = db.query(models.Comment).filter(models.Comment.post_id.in_(user_posts_ids), models.Comment.is_cyberbullying == True).count()
    
    hate_measure = min(100.0, float(toxic_comments_received)) # As per prompt, 100 toxic comments = 100%
    
    my_posts = crud.get_posts(db) # actually filter by me
    my_posts_json = [{"id": p.id, "image_path": p.image_path, "description": p.description} for p in current_user.posts if p.status == 'active']
    
    strikes = [{"reason": s.reason, "created_at": s.created_at} for s in current_user.strikes]
    
    return {
        "username": current_user.username,
        "email": current_user.email,
        "strike_count": current_user.strike_count,
        "strikes": strikes,
        "hate_measure_percentage": hate_measure,
        "posts": my_posts_json
    }

# -----------------
# API: Admin
# -----------------
@app.get("/api/admin/dashboard")
def admin_dashboard(current_admin: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_admin.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    user_count = db.query(models.User).count()
    blocked_user_count = db.query(models.User).filter(models.User.is_blocked == True).count()
    
    total_comments = db.query(models.Comment).count()
    toxic_comments = db.query(models.Comment).filter(models.Comment.is_cyberbullying == True).count()
    normal_comments = total_comments - toxic_comments
    
    models_metrics = [{"model_name": m.model_name, "model_type": m.model_type, "accuracy": m.accuracy, "precision": m.precision} for m in db.query(models.ModelMetric).all()]
    users = [{"id": u.id, "username": u.username, "strikes": u.strike_count, "is_blocked": u.is_blocked, "role": u.role} for u in db.query(models.User).all()]
    
    return {
        "user_count": user_count,
        "blocked_users": blocked_user_count,
        "total_comments": total_comments,
        "toxic_comments": toxic_comments,
        "normal_comments": normal_comments,
        "models_metrics": models_metrics,
        "users": users
    }

@app.post("/api/admin/users/{user_id}/toggle_block")
def toggle_block(user_id: int, current_admin: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_admin.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_blocked = not user.is_blocked
    if not user.is_blocked:
        user.block_expires_at = None
    else:
        # Manual block lasts forever
        import datetime
        user.block_expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=36500)
    db.commit()
    return {"message": "Toggled", "is_blocked": user.is_blocked}

# -----------------
# Frontend Routing (Serving static HTML via FastAPI)
# -----------------
@app.get("/", response_class=HTMLResponse)
def serve_index():
    with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
        return f.read()

@app.get("/admin", response_class=HTMLResponse)
def serve_admin():
    with open(os.path.join(STATIC_DIR, "admin.html"), "r", encoding="utf-8") as f:
        return f.read()
