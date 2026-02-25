from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from backend.admin import require_admin
from backend.auth import get_current_user, http_bearer
from fastapi.security import HTTPAuthorizationCredentials
from backend.models import AddAdminRequest, RemoveAdminRequest, AddGraderRequest, RemoveGraderRequest
from backend.db_mongo import users_collection

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/check")
async def check_admin_status(user: dict = Depends(require_admin)):
    """Check if current user is an admin"""
    return {
        "is_admin": user.get("is_admin", False),
        "is_grader": user.get("is_grader", False),
        "email": user["email"]
    }

@router.get("/list")
async def list_admins(user: dict = Depends(require_admin)):
    """List all admins"""
    admins = []
    
    # Get all admins from database
    cursor = users_collection.find({"is_admin": True})
    async for admin_user in cursor:
        admins.append({
            "email": admin_user["email"],
            "username": admin_user.get("username", "N/A"),
            "added_at": admin_user.get("admin_since", "N/A").isoformat() if isinstance(admin_user.get("admin_since"), datetime) else "N/A",
            "added_by": admin_user.get("added_by", "System"),
            "is_grader": admin_user.get("is_grader", False)
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
    """Remove an admin (cannot remove yourself)"""
    email = request.email.lower()
    
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


@router.get("/graders")
async def list_graders(user: dict = Depends(require_admin)):
    """List all graders (admin only)"""
    graders = []
    
    # Get all graders from database
    cursor = users_collection.find({"is_grader": True})
    async for grader_user in cursor:
        graders.append({
            "email": grader_user["email"],
            "username": grader_user.get("username", "N/A"),
            "is_admin": grader_user.get("is_admin", False),
            "added_at": grader_user.get("grader_since", "N/A").isoformat() if isinstance(grader_user.get("grader_since"), datetime) else "N/A",
            "added_by": grader_user.get("grader_added_by", "System")
        })
    
    return {"graders": graders, "total": len(graders)}

@router.post("/graders/add")
async def add_grader(request: AddGraderRequest, user: dict = Depends(require_admin)):
    """Add grader privileges to a user (admin only)"""
    email = request.email.lower()
    
    # Check if user exists
    user_doc = await users_collection.find_one({"email": email})
    
    if not user_doc:
        raise HTTPException(
            status_code=404,
            detail="User not found. User must log in at least once before being made a grader."
        )
    
    # Check if already grader
    if user_doc.get("is_grader", False):
        raise HTTPException(status_code=400, detail="User is already a grader")
    
    # Add grader privileges
    await users_collection.update_one(
        {"email": email},
        {
            "$set": {
                "is_grader": True,
                "grader_since": datetime.now(timezone.utc),
                "grader_added_by": user["email"]
            }
        }
    )
    
    return {
        "message": f"Successfully added {email} as grader",
        "email": email,
        "username": user_doc.get("username", "N/A"),
        "added_at": datetime.now(timezone.utc).isoformat(),
        "added_by": user["email"]
    }

@router.delete("/graders/remove")
async def remove_grader(request: RemoveGraderRequest, user: dict = Depends(require_admin)):
    """Remove grader privileges (admin only, cannot remove yourself)"""
    email = request.email.lower()
    
    # Cannot remove yourself
    if email == user["email"].lower():
        raise HTTPException(status_code=400, detail="Cannot remove your own grader privileges")
    
    # Check if user exists and is grader
    user_doc = await users_collection.find_one({"email": email})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user_doc.get("is_grader", False):
        raise HTTPException(status_code=400, detail="User is not a grader")
    
    # Remove grader privileges
    await users_collection.update_one(
        {"email": email},
        {
            "$set": {"is_grader": False},
            "$unset": {
                "grader_since": "",
                "grader_added_by": ""
            }
        }
    )
    
    return {
        "message": f"Successfully removed grader privileges from {email}",
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