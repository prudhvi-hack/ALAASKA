from fastapi import HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.config import FRONTEND_URL

def get_cors_middleware():
    """Configure CORS middleware"""
    return {
        "allow_origins": [FRONTEND_URL],
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["*"],
    }

async def add_security_headers(request: Request, call_next):
    """Add security headers to responses"""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

async def limit_request_size(request: Request, call_next):
    """Limit request body size to prevent abuse"""
    if request.headers.get("content-length"):
        content_length = int(request.headers.get("content-length"))
        if content_length > 1_000_000:
            raise HTTPException(status_code=413, detail="Request too large")
    response = await call_next(request)
    return response