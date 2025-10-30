from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user, http_bearer
from fastapi.security import HTTPAuthorizationCredentials
from backend.db_mongo import conversations_collection

router = APIRouter()

@router.get("/conversations")
async def get_conversations(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get all conversations for the current user"""
    user = await get_current_user(auth)
    user_id = user["auth0_id"]
    
    cursor = conversations_collection.find(
        {"user_id": user_id, "is_deleted": False},
        {"_id": 0}
    ).sort("updated_at", -1)
    
    conversations = []
    async for conv in cursor:
        conversations.append({
            "chat_id": conv["chat_id"],
            "summary": conv.get("summary", "New Chat"),
            "created_at": conv["created_at"].isoformat() if "created_at" in conv else None,
            "updated_at": conv["updated_at"].isoformat() if "updated_at" in conv else None,
            "is_assignment_chat": conv.get("is_assignment_chat", False)
        })
    
    return conversations

@router.get("/conversation/{chat_id}")
async def get_conversation(chat_id: str, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get a specific conversation's messages"""
    user = await get_current_user(auth)
    user_id = user["auth0_id"]
    
    conversation = await conversations_collection.find_one({
        "chat_id": chat_id,
        "user_id": user_id,
        "is_deleted": False
    })
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation.get("messages", [])

@router.put("/conversation/{chat_id}/delete")
async def delete_conversation(chat_id: str, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Soft delete a conversation"""
    user = await get_current_user(auth)
    user_id = user["auth0_id"]
    
    result = await conversations_collection.update_one(
        {"chat_id": chat_id, "user_id": user_id},
        {"$set": {"is_deleted": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": "Conversation deleted successfully"}