from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from datetime import datetime, timezone
import httpx
import requests
from backend.db_mongo import users_collection
from backend.config import AUTH0_DOMAIN, AUTH0_API_AUDIENCE, ALGORITHM
import logging
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

http_bearer = HTTPBearer()

# Cache JWKS for 1 hour to reduce calls
@lru_cache(maxsize=1)
def get_auth0_jwks():
    """Fetch Auth0 JWKS for token verification (cached)"""
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    logger.info(f"[AUTH] Fetching JWKS from: {jwks_url}")
    try:
        jwks = requests.get(jwks_url, timeout=60).json()
        logger.info(f"[AUTH] Successfully fetched JWKS with {len(jwks.get('keys', []))} keys")
        return jwks
    except Exception as e:
        logger.error(f"[AUTH] Failed to fetch JWKS: {str(e)}")
        raise

def verify_token(token: str):
    """Verify and decode Auth0 JWT token"""
    logger.info("[AUTH] Starting token verification")
    logger.debug(f"[AUTH] Token (first 20 chars): {token[:20]}...")
    
    try:
        jwks = get_auth0_jwks()
        unverified_header = jwt.get_unverified_header(token)
        logger.info(f"[AUTH] Unverified header kid: {unverified_header.get('kid')}")
        logger.debug(f"[AUTH] Unverified header: {unverified_header}")
        
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                logger.info(f"[AUTH] Found matching RSA key for kid: {key['kid']}")
                break
        
        if not rsa_key:
            logger.error(f"[AUTH] No matching key found for kid: {unverified_header.get('kid')}")
            logger.debug(f"[AUTH] Available kids: {[k['kid'] for k in jwks['keys']]}")
            raise HTTPException(status_code=401, detail="Unable to find appropriate key")
        
        logger.info(f"[AUTH] Decoding token with audience: {AUTH0_API_AUDIENCE}")
        logger.info(f"[AUTH] Expected issuer: https://{AUTH0_DOMAIN}/")
        logger.info(f"[AUTH] Algorithm: {ALGORITHM}")
        
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHM,
            audience=AUTH0_API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        
        logger.info(f"[AUTH] Token decoded successfully")
        logger.info(f"[AUTH] Token sub: {payload.get('sub')}")
        logger.info(f"[AUTH] Token aud: {payload.get('aud')}")
        logger.info(f"[AUTH] Token iss: {payload.get('iss')}")
        logger.info(f"[AUTH] Token exp: {payload.get('exp')} (now: {datetime.now(timezone.utc).timestamp()})")
        logger.debug(f"[AUTH] Full payload: {payload}")
        
        return payload
        
    except jwt.ExpiredSignatureError as e:
        logger.error(f"[AUTH] Token expired: {str(e)}")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTClaimsError as e:
        logger.error(f"[AUTH] JWT claims error: {str(e)}")
        logger.error(f"[AUTH] Expected audience: {AUTH0_API_AUDIENCE}")
        logger.error(f"[AUTH] Expected issuer: https://{AUTH0_DOMAIN}/")
        raise HTTPException(status_code=401, detail="Incorrect claims")
    except Exception as e:
        logger.error(f"[AUTH] Token verification failed: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_userinfo_from_token(payload: dict) -> dict:
    """Extract user info directly from JWT payload (no API call needed!)"""
    logger.info("[AUTH] Extracting user info from token payload")
    
    # Try different claim formats Auth0 might use
    namespace = 'https://alaaska.com/'
    
    email = (
        payload.get("email") or 
        payload.get(f"{namespace}email") or
        payload.get("https://example.com/email") or
        None
    )
    
    name = (
        payload.get("name") or 
        payload.get(f"{namespace}name") or
        payload.get("nickname") or
        payload.get("sub", "").split("|")[-1]
    )
    
    email_verified = (
        payload.get("email_verified") or
        payload.get(f"{namespace}email_verified") or
        False
    )
    
    user_info = {
        "sub": payload.get("sub"),
        "email": email,
        "name": name,
        "email_verified": email_verified
    }
    
    logger.info(f"[AUTH] Extracted user info from token: {user_info.get('email', 'NO_EMAIL')}")
    logger.debug(f"[AUTH] Full token payload keys: {list(payload.keys())}")
    logger.debug(f"[AUTH] User info from token: {user_info}")
    
    return user_info

async def get_userinfo_from_api(access_token: str) -> dict:
    """Fetch user information from Auth0 API (fallback only)"""
    userinfo_url = f"https://{AUTH0_DOMAIN}/userinfo"
    logger.info(f"[AUTH] Fetching user info from API: {userinfo_url}")
    logger.debug(f"[AUTH] Using token (first 20 chars): {access_token[:20]}...")
    
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(userinfo_url, headers=headers)
            logger.info(f"[AUTH] Userinfo API response status: {response.status_code}")
            
            if response.status_code == 429:
                logger.error("[AUTH] Rate limit hit on Auth0 /userinfo endpoint!")
                raise HTTPException(status_code=429, detail="Auth0 rate limit exceeded. Try again later.")
            
            if response.status_code != 200:
                logger.error(f"[AUTH] Failed to fetch user info: {response.status_code}")
                logger.error(f"[AUTH] Response body: {response.text}")
                raise HTTPException(status_code=401, detail="Failed to fetch user info")
            
            user_info = response.json()
            logger.info(f"[AUTH] Successfully fetched user info from API for: {user_info.get('email', 'NO_EMAIL')}")
            logger.debug(f"[AUTH] User info from API: {user_info}")
            return user_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTH] Error fetching user info from API: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=401, detail="Failed to fetch user info")

async def get_or_create_user(auth0_id: str, email: str, name: str) -> dict:
    """Get user from database or create if doesn't exist (optimized with single query)"""
    logger.info(f"[AUTH] Getting or creating user: {email} (auth0_id: {auth0_id})")
    
    # Try to find and update in one operation (upsert)
    user_doc = await users_collection.find_one_and_update(
        {"auth0_id": auth0_id},
        {
            "$setOnInsert": {
                "auth0_id": auth0_id,
                "username": name,
                "email": email,
                "created_at": datetime.now(timezone.utc),
                "is_admin": False,
                "is_grader": False
            },
            "$set": {
                "last_login": datetime.now(timezone.utc)
            }
        },
        upsert=True,
        return_document=True  # Return the document after update
    )
    
    if user_doc:
        logger.info(f"[AUTH] User found/created: {email}")
        return user_doc
    else:
        logger.error(f"[AUTH] Failed to get/create user: {email}")
        raise HTTPException(status_code=500, detail="Failed to create user")

async def get_current_user(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get current authenticated user (OPTIMIZED - minimal Auth0 API calls)"""
    logger.info("[AUTH] get_current_user called")
    
    token = auth.credentials
    logger.debug(f"[AUTH] Received token (first 20 chars): {token[:20]}...")
    
    try:
        # Step 1: Verify token (uses cached JWKS)
        payload = verify_token(token)
        
        # Step 2: Extract user info from token payload (NO API CALL!)
        user_info = await get_userinfo_from_token(payload)
        
        user_id = user_info["sub"]
        email = user_info.get("email", "")
        
        # If email not in token, fall back to API call (rare case)
        if not email:
            logger.warning("[AUTH] Email not in token payload, fetching from Auth0 API")
            api_user_info = await get_userinfo_from_api(token)
            email = api_user_info.get("email", "")
        
        name = user_info.get("name") or user_id

        # Step 3: Get or create user in database (single optimized query)
    
        user_doc = await get_or_create_user(user_id, email, name)
        
        logger.info(f"[AUTH] Returning user data for: {email}")
        
        return {
            "auth0_id": user_id,
            "username": name,
            "email": email,
            "is_admin": user_doc.get("is_admin", False),
            "is_grader": user_doc.get("is_grader", False)
        }
        
    except HTTPException as e:
        logger.error(f"[AUTH] HTTPException in get_current_user: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[AUTH] Unexpected error in get_current_user: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")