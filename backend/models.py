from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

class User(BaseModel):
    username: str
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=10000, min_length=1)
    chat_id: str | None = None
    
    @field_validator('message')
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        return v.strip()

# Admin models
class AddAdminRequest(BaseModel):
    email: EmailStr

class RemoveAdminRequest(BaseModel):
    email: EmailStr

class AddGraderRequest(BaseModel):
    email: EmailStr

class RemoveGraderRequest(BaseModel):
    email: EmailStr