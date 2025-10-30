from fastapi import Depends, HTTPException
from backend.auth import get_current_user
from backend.db_mongo import users_collection

SUPER_ADMIN_EMAIL = "gvp5349@psu.edu"

async def is_admin(user: dict = Depends(get_current_user)) -> bool:
    """Check if user is an admin"""
    email = user["email"].lower()
    
    # Super admin always has access
    if email == SUPER_ADMIN_EMAIL:
        return True
    
    # Check if user is in admin list
    user_doc = await users_collection.find_one({"email": email})
    if user_doc and user_doc.get("is_admin", False):
        return True
    
    return False

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency to require admin access"""
    email = user["email"].lower()
    
    # Super admin always has access (but don't expose this in response)
    if email == SUPER_ADMIN_EMAIL:
        # Check database for admin status
        user_doc = await users_collection.find_one({"email": email})
        if user_doc and user_doc.get("is_admin", False):
            user["is_admin"] = True
            return user
        # If not in DB yet, still allow (for initialization)
        user["is_admin"] = True
        return user
    
    # Check if user is in admin list
    user_doc = await users_collection.find_one({"email": email})
    if user_doc and user_doc.get("is_admin", False):
        user["is_admin"] = True
        return user
    
    raise HTTPException(status_code=403, detail="Admin access required")