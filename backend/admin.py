from fastapi import Depends, HTTPException
from backend.auth import get_current_user
from backend.db_mongo import users_collection


async def is_admin(user: dict = Depends(get_current_user)) -> bool:
    """Check if user is an admin"""
    return user.get("is_admin", False)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency to require admin access"""
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def is_grader(user: dict = Depends(get_current_user)) -> bool:
    """Check if user is a grader or admin"""
    return user.get("is_grader", False) or user.get("is_admin", False)


async def require_grader(user: dict = Depends(get_current_user)) -> dict:
    """Dependency to require grader or admin access"""
    if not (user.get("is_grader", False) or user.get("is_admin", False)):
        raise HTTPException(status_code=403, detail="Grader access required")
    return user