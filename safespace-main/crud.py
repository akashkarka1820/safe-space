from sqlalchemy.orm import Session
import models, schemas
from auth import get_password_hash
import datetime

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(username=user.username, email=user.email, password_hash=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_post(db: Session, post: schemas.PostCreate, user_id: int):
    db_post = models.Post(**post.dict(), user_id=user_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

def get_posts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Post).filter(models.Post.status == 'active').order_by(models.Post.created_at.desc()).offset(skip).limit(limit).all()

def create_comment(db: Session, comment: schemas.CommentCreate, user_id: int, is_cyberbullying: bool = False):
    db_comment = models.Comment(
        post_id=comment.post_id,
        user_id=user_id,
        content=comment.content,
        is_cyberbullying=is_cyberbullying
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def add_strike(db: Session, user_id: int, reason: str):
    user = get_user(db, user_id)
    if not user:
        return None
    
    # Add strike record
    strike = models.Strike(user_id=user_id, reason=reason)
    db.add(strike)
    
    # Increment user strike count
    user.strike_count += 1
    
    # Apply penalty
    if user.strike_count == 1:
        user.block_expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        user.is_blocked = True
    elif user.strike_count == 2:
        user.block_expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=1)
        user.is_blocked = True
    elif user.strike_count >= 3:
        # Permanent block (block_expires_at can be far future or we just rely on is_blocked)
        user.block_expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=36500)
        user.is_blocked = True
        
    db.commit()
    db.refresh(user)
    return user

def unblock_user(db: Session, user_id: int):
    user = get_user(db, user_id)
    if user:
        user.is_blocked = False
        user.block_expires_at = None
        user.strike_count = 0 # reset strikes when admin unblocks? Optional. Let's not reset it unless explicitly requested.
        db.commit()
        db.refresh(user)
    return user

def save_model_metric(db: Session, metric: schemas.ModelMetric):
    db_metric = models.ModelMetric(
        model_name=metric.model_name,
        model_type=metric.model_type,
        accuracy=metric.accuracy,
        precision=metric.precision,
        recall=metric.recall,
        f1_score=metric.f1_score
    )
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric

def get_model_metrics(db: Session):
    return db.query(models.ModelMetric).all()

def toggle_like(db: Session, post_id: int, user_id: int):
    like = db.query(models.Like).filter(models.Like.post_id == post_id, models.Like.user_id == user_id).first()
    if like:
        db.delete(like)
        db.commit()
        return False
    else:
        new_like = models.Like(post_id=post_id, user_id=user_id)
        db.add(new_like)
        db.commit()
        return True
