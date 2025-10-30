from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from datetime import datetime, timezone
import httpx
import requests
from backend.db_mongo import users_collection
from backend.config import AUTH0_DOMAIN, AUTH0_API_AUDIENCE, ALGORITHM

http_bearer = HTTPBearer()

def get_auth0_jwks():
    """Fetch Auth0 JWKS for token verification"""
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    jwks = requests.get(jwks_url, timeout=60).json()
    return jwks

def verify_token(token: str):
    """Verify and decode Auth0 JWT token"""
    jwks = get_auth0_jwks()
    unverified_header = jwt.get_unverified_header(token)
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
    if not rsa_key:
        raise HTTPException(status_code=401, detail="Unable to find appropriate key")
    
    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHM,
            audience=AUTH0_API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTClaimsError:
        raise HTTPException(status_code=401, detail="Incorrect claims")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

async def get_userinfo(access_token: str):
    """Fetch user information from Auth0"""
    userinfo_url = f"https://{AUTH0_DOMAIN}/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(userinfo_url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch user info")
        return response.json()

async def get_current_user(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get current authenticated user and create/update user in database"""
    token = auth.credentials
    payload = verify_token(token)
    user_info = await get_userinfo(token)

    user_id = payload["sub"]
    email = user_info.get("email", "")
    name = user_info.get("name") or user_info.get("nickname") or user_id

    existing = await users_collection.find_one({"auth0_id": user_id})
    if not existing:
        user_doc = {
            "auth0_id": user_id,
            "username": name,
            "email": email,
            "created_at": datetime.now(timezone.utc)
        }
        await users_collection.insert_one(user_doc)
    
    return {"auth0_id": user_id, "username": name, "email": email}