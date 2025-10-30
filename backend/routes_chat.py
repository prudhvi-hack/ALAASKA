from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from datetime import datetime, timezone
from openai import AsyncOpenAI
import uuid
import logging
from backend.auth import get_current_user
from backend.rate_limiter import rate_limit_dependency, record_request
from backend.models import ChatRequest
from backend.utils import summarize_prompt
from backend.db_mongo import conversations_collection, messages_collection
from backend.config import OPENAI_API_KEY, MODEL_ID

router = APIRouter()
client = AsyncOpenAI(api_key=OPENAI_API_KEY)
logger = logging.getLogger(__name__)
http_bearer = HTTPBearer()

@router.post("/chat/start")
async def start_chat(user: dict = Depends(get_current_user), user_key: str = Depends(rate_limit_dependency)):
    """Start a new chat conversation"""
    chat_id = f"{uuid.uuid4().hex[:8]}"
    username = user["username"]
    auth0_id = user["auth0_id"]
    email = user["email"]

    system_message = {
        "role": "system",
        "content": (
            "You are ALAASKA, a supportive teaching assistant. Your job is to guide the user to think critically and find the solution on their own."
            "Keep the conversation going with a question at the end your replies."
            "Identify the student's level with guiding questions about the topic they are inquiring about."
            "When appropriate throughout the conversation use these: flashcards, mini quizzes, scenarios, hints."
            "Discuss only academic topics and nothing else."
        )
    }

    assistant_welcome = {"role": "assistant", "content": "Hi! Welcome to ALAASKA. How can I help you today?"}
    messages = [system_message, assistant_welcome]

    await conversations_collection.insert_one({
        "chat_id": chat_id,
        "auth0_id": auth0_id,
        "username": username,
        "email": email,
        "summary": "",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })

    await messages_collection.insert_many([
        {**system_message, "chat_id": chat_id, "timestamp": datetime.now(timezone.utc), "auth0_id": auth0_id, "username": username, "email": email},
        {**assistant_welcome, "chat_id": chat_id, "timestamp": datetime.now(timezone.utc), "auth0_id": auth0_id, "username": username, "email": email},
    ])

    record_request(f"start:{user_key}")
    
    return {"response": assistant_welcome["content"], "chat_id": chat_id, "history": messages}

@router.post("/chat")
async def chat(request: ChatRequest, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    user = await get_current_user(auth)
    user_id = user["auth0_id"]
    
    chat_id = request.chat_id or str(uuid.uuid4())
    
    # Get existing conversation from database if chat_id exists
    existing_conversation = None
    if request.chat_id:
        existing_conversation = await conversations_collection.find_one({
            "chat_id": request.chat_id,
            "user_id": user_id,
            "is_deleted": False
        })
        
        if existing_conversation:
            print(f"=== LOADED CONVERSATION {chat_id} ===")
            print(f"Total messages in DB: {len(existing_conversation.get('messages', []))}")
            print(f"Is assignment chat: {existing_conversation.get('is_assignment_chat', False)}")
            
            # Print first message to verify system prompt
            if existing_conversation.get('messages'):
                first_msg = existing_conversation['messages'][0]
                print(f"First message role: {first_msg['role']}")
                if first_msg['role'] == 'system':
                    print(f"System prompt (first 200 chars): {first_msg['content'][:200]}...")
    
    # Use database messages if they exist, otherwise use request messages
    if existing_conversation:
        # Use messages from database (includes system message)
        conversation_messages = existing_conversation.get("messages", [])
        # Append the new user message (last message from request)
        new_user_message = request.messages[-1]
        conversation_messages.append(new_user_message)
        
        print(f"Total messages being sent to Claude: {len(conversation_messages)}")
    else:
        # New conversation
        conversation_messages = request.messages
        print(f"New conversation - messages from request: {len(conversation_messages)}")
    
    # Generate summary for new conversations
    if not existing_conversation:
        summary = await generate_summary(conversation_messages)
    else:
        summary = existing_conversation.get("summary", "Chat")
    
    async def event_generator():
        try:
            full_response = ""
            
            async for chunk in stream_claude_response(conversation_messages):
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
            
            # Save the complete conversation
            assistant_message = {"role": "assistant", "content": full_response}
            all_messages = conversation_messages + [assistant_message]
            
            conversation_doc = {
                "chat_id": chat_id,
                "user_id": user_id,
                "messages": all_messages,
                "summary": summary,
                "created_at": existing_conversation.get("created_at") if existing_conversation else datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "is_deleted": False,
                "is_assignment_chat": existing_conversation.get("is_assignment_chat", False) if existing_conversation else False,
                "assignment_id": existing_conversation.get("assignment_id") if existing_conversation else None,
                "question_id": existing_conversation.get("question_id") if existing_conversation else None
            }
            
            await conversations_collection.replace_one(
                {"chat_id": chat_id, "user_id": user_id},
                conversation_doc,
                upsert=True
            )
            
            yield f"data: {json.dumps({'chat_id': chat_id})}\n\n"
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Error in chat stream: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

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
    
    # Return ALL messages including system message
    return conversation.get("messages", [])