from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from backend.admin import require_admin, SUPER_ADMIN_EMAIL
from backend.auth import get_current_user, http_bearer
from fastapi.security import HTTPAuthorizationCredentials
from backend.models import AddAdminRequest, RemoveAdminRequest
from backend.db_mongo import users_collection

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/initialize")
async def initialize_super_admin(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Initialize super admin - auto-grants admin if user is super admin email"""
    user = await get_current_user(auth)
    
    email = user["email"].lower()
    
    # Only allow super admin to initialize themselves
    if email != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Only super admin can use this endpoint")
    
    # Check if already initialized
    user_doc = await users_collection.find_one({"email": email})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found in database")
    
    # Check if already admin
    if user_doc.get("is_admin", False):
        return {
            "message": "Super admin already initialized",
            "email": email,
            "is_admin": True
        }
    
    # Initialize super admin - UPDATE THE EXISTING USER
    await users_collection.update_one(
        {"email": email},
        {
            "$set": {
                "is_admin": True,
                "admin_since": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Super admin initialized successfully",
        "email": email,
        "is_admin": True
    }

@router.get("/check")
async def check_admin_status(user: dict = Depends(require_admin)):
    """Check if current user is an admin"""
    return {
        "is_admin": user.get("is_admin", False),
        "email": user["email"]
    }

@router.get("/list")
async def list_admins(user: dict = Depends(require_admin)):
    """List all admins"""
    admins = []
    
    # Get all admins from database (including super admin)
    cursor = users_collection.find({"is_admin": True})
    async for admin_user in cursor:
        admins.append({
            "email": admin_user["email"],
            "username": admin_user.get("username", "N/A"),
            "added_at": admin_user.get("admin_since", "N/A").isoformat() if isinstance(admin_user.get("admin_since"), datetime) else "N/A",
            "added_by": admin_user.get("added_by", "Super Admin" if admin_user["email"] == SUPER_ADMIN_EMAIL else "N/A")
        })
    
    return {"admins": admins, "total": len(admins)}

@router.post("/add")
async def add_admin(request: AddAdminRequest, user: dict = Depends(require_admin)):
    """Add a new admin (any admin can add)"""
    email = request.email.lower()
    
    # Check if user exists
    user_doc = await users_collection.find_one({"email": email})
    
    if not user_doc:
        raise HTTPException(
            status_code=404, 
            detail="User not found. User must log in at least once before being made an admin."
        )
    
    # Check if already admin
    if user_doc.get("is_admin", False):
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    # Add admin privileges
    await users_collection.update_one(
        {"email": email},
        {
            "$set": {
                "is_admin": True,
                "admin_since": datetime.now(timezone.utc),
                "added_by": user["email"]
            }
        }
    )
    
    return {
        "message": f"Successfully added {email} as admin",
        "email": email,
        "username": user_doc.get("username", "N/A"),
        "added_at": datetime.now(timezone.utc).isoformat(),
        "added_by": user["email"]
    }

@router.delete("/remove")
async def remove_admin(request: RemoveAdminRequest, user: dict = Depends(require_admin)):
    """Remove an admin (any admin can remove, except yourself and super admin)"""
    email = request.email.lower()
    
    # Cannot remove super admin
    if email == SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=400, detail="Cannot remove the primary admin")
    
    # Cannot remove yourself
    if email == user["email"].lower():
        raise HTTPException(status_code=400, detail="Cannot remove your own admin privileges")
    
    # Check if user exists and is admin
    user_doc = await users_collection.find_one({"email": email})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user_doc.get("is_admin", False):
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    # Remove admin privileges
    await users_collection.update_one(
        {"email": email},
        {
            "$set": {"is_admin": False},
            "$unset": {
                "admin_since": "", 
                "added_by": ""
            }
        }
    )
    
    return {
        "message": f"Successfully removed admin privileges from {email}",
        "email": email,
        "removed_by": user["email"]
    }

@router.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    """List all users (admin only) - for assigning assignments"""
    cursor = users_collection.find({}, {"auth0_id": 1, "email": 1, "username": 1, "_id": 0})
    users = []
    async for user_doc in cursor:
        users.append(user_doc)
    return {"users": users}