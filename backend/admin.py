from fastapi import Depends, HTTPException
from backend.auth import get_current_user
from backend.db_mongo import users_collection


async def is_admin(user: dict = Depends(get_current_user)) -> bool:
    """Check if user is an admin"""
    # Simply check database for admin status
    user_doc = await users_collection.find_one({"auth0_id": user["auth0_id"]})
    
    if user_doc and user_doc.get("is_admin", False):
        return True
    
    return False


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency to require admin access"""
    # Check database for admin status
    user_doc = await users_collection.find_one({"auth0_id": user["auth0_id"]})
    
    if user_doc and user_doc.get("is_admin", False):
        user["is_admin"] = True
        return user
    
    raise HTTPException(status_code=403, detail="Admin access required")