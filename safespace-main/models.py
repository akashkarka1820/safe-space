import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    email = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="user") # 'user' or 'admin'
    strike_count = Column(Integer, default=0)
    is_blocked = Column(Boolean, default=False)
    block_expires_at = Column(DateTime, nullable=True)

    posts = relationship("Post", back_populates="owner")
    comments = relationship("Comment", back_populates="owner")
    strikes = relationship("Strike", back_populates="user")
    likes = relationship("Like", back_populates="owner")

class Like(Base):
    __tablename__ = "likes"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    post = relationship("Post", back_populates="likes")
    owner = relationship("User", back_populates="likes")

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_path = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="active") # 'active' or 'blocked'

    owner = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post")
    likes = relationship("Like", back_populates="post")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String)
    is_cyberbullying = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    owner = relationship("User", back_populates="comments")

class Strike(Base):
    __tablename__ = "strikes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    reason = Column(String) # e.g., 'text: toxic comment', 'image: hateful meme'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="strikes")

class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String) # e.g., 'xgboost', 'resnet50'
    model_type = Column(String) # 'text' or 'image'
    accuracy = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
