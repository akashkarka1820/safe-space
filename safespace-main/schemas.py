from pydantic import BaseModel
from typing import List, Optional
import datetime

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    email: str
    password: str

class UserLogin(UserBase):
    password: str

class User(UserBase):
    id: int
    email: Optional[str] = None
    role: str
    strike_count: int
    is_blocked: bool
    block_expires_at: Optional[datetime.datetime]

    class Config:
        from_attributes = True

class PostBase(BaseModel):
    description: Optional[str] = None

class PostCreate(PostBase):
    image_path: Optional[str] = None

class Post(PostBase):
    id: int
    user_id: int
    image_path: Optional[str] = None
    created_at: datetime.datetime
    status: str

    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    post_id: int

class Comment(CommentBase):
    id: int
    post_id: int
    user_id: int
    is_cyberbullying: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class StrikeBase(BaseModel):
    reason: str

class Strike(StrikeBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class ModelMetric(BaseModel):
    id: int
    model_name: str
    model_type: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
