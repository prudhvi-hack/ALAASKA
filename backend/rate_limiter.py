from fastapi import HTTPException, Request, Depends
from collections import defaultdict
from typing import Dict, List
import time
from backend.auth import get_current_user

rate_limit_storage: Dict[str, List[float]] = defaultdict(list)

def cleanup_old_requests(user_key: str, window_seconds: int = 60):
    """Remove timestamps older than the window"""
    current_time = time.time()
    cutoff_time = current_time - window_seconds
    rate_limit_storage[user_key] = [
        timestamp for timestamp in rate_limit_storage[user_key] 
        if timestamp > cutoff_time
    ]

def check_rate_limit(user_key: str, max_requests: int, window_seconds: int = 60) -> bool:
    """Check if user has exceeded rate limit"""
    cleanup_old_requests(user_key, window_seconds)
    current_requests = len(rate_limit_storage[user_key])
    return current_requests < max_requests

def record_request(user_key: str):
    """Record a new request timestamp"""
    rate_limit_storage[user_key].append(time.time())

async def rate_limit_dependency(request: Request, user: dict = Depends(get_current_user)):
    """Dependency to enforce rate limits on endpoints"""
    auth0_id = user["auth0_id"]
    user_key = auth0_id
    
    path = request.url.path
    
    if path == "/chat/start":
        if not check_rate_limit(f"start:{user_key}", 5):
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded for starting new chats. Try again in a minute.",
                headers={"Retry-After": "60"}
            )
    elif path == "/chat":
        if not check_rate_limit(f"chat:{user_key}", 20):
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded for chat messages. Try again in a minute.",
                headers={"Retry-After": "60"}
            )
    
    return user_key