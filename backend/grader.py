from fastapi import HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from backend.auth import get_current_user, http_bearer

async def require_grader(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Dependency to check if user is a grader"""
    user = await get_current_user(auth)
    
    if not user.get("is_grader", False):
        raise HTTPException(
            status_code=403,
            detail="This endpoint requires grader privileges"
        )
    
    return user