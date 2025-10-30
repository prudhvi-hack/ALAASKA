from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from backend.auth import get_current_user, http_bearer
from backend.models import ChatRequest
from backend.db_mongo import conversations_collection
from backend.config import OPENAI_API_KEY, MODEL_ID, SUMMARIZE_MODEL_ID
from openai import AsyncOpenAI
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

SYSTEM_PROMPT = (
    "You are ALAASKA, a supportive teaching assistant. Your job is to guide the user to think critically and find the solution on their own."
    "Keep the conversation going with a question at the end your replies."
    "Identify the student's level with guiding questions about the topic they are inquiring about."
    "When appropriate throughout the conversation use these: flashcards, mini quizzes, scenarios, hints."
    "Discuss only academic topics and nothing else."
)

async def summarize_title(text: str) -> str:
    try:
        resp = await client.chat.completions.create(
            model=SUMMARIZE_MODEL_ID,
            messages=[
                {"role": "system", "content": "Give a 4-word title to this message"},
                {"role": "user", "content": text}
            ],
            temperature=0.3
        )
        return (resp.choices[0].message.content or "").strip().strip('"')
    except Exception as e:
        logger.warning(f"Title summarization failed: {e}")
        # Fallback: first 50 chars
        s = (text or "").strip()
        return s if len(s) <= 50 else s[:50] + "..."

def now_utc():
    return datetime.now(timezone.utc)

@router.post("/chat/start")
async def start_chat(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    user = await get_current_user(auth)
    user_id = user["auth0_id"]

    chat_id = uuid.uuid4().hex  # 32-char hex id used elsewhere (assignments use uuid4())
    initial_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "assistant", "content": "Hi! Welcome to ALAASKA. How can I help you today?"}
    ]

    conversation_doc = {
        "chat_id": chat_id,
        "user_id": user_id,
        "messages": initial_messages,
        "summary": "New Chat",
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "is_deleted": False,
        "is_assignment_chat": False,
        "assignment_id": None,
        "question_id": None,
    }

    await conversations_collection.insert_one(conversation_doc)

    return {
        "response": initial_messages[1]["content"],
        "chat_id": chat_id,
        "history": initial_messages
    }

@router.post("/chat")
async def chat(request: ChatRequest, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    user = await get_current_user(auth)
    user_id = user["auth0_id"]

    msg_text = (request.message or "").strip()
    if not msg_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(msg_text) > 3000:
        raise HTTPException(status_code=400, detail="Message exceeds maximum length of 3000 characters")

    chat_id = request.chat_id or uuid.uuid4().hex
    existing = None

    if request.chat_id:
        existing = await conversations_collection.find_one({
            "chat_id": request.chat_id,
            "user_id": user_id,
            "is_deleted": False
        })

    if existing:
        messages = existing.get("messages", [])
        summary = existing.get("summary", "New Chat")
    else:
        # New conversation
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
        summary = "New Chat"

    # Append user message
    messages.append({"role": "user", "content": msg_text})

    # Call OpenAI for assistant reply
    try:
        resp = await client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            temperature=0.7
        )
        reply = resp.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"OpenAI chat error: {e}")
        raise HTTPException(status_code=500, detail="LLM error")

    # Append assistant message
    messages.append({"role": "assistant", "content": reply})

    # If new conversation, compute summary from first user message
    if not existing and summary in ("", "New Chat"):
        summary = await summarize_title(msg_text)

    conversation_doc = {
        "chat_id": chat_id,
        "user_id": user_id,
        "messages": messages,
        "summary": summary,
        "created_at": existing.get("created_at") if existing else now_utc(),
        "updated_at": now_utc(),
        "is_deleted": existing.get("is_deleted", False) if existing else False,
        "is_assignment_chat": existing.get("is_assignment_chat", False) if existing else False,
        "assignment_id": existing.get("assignment_id") if existing else None,
        "question_id": existing.get("question_id") if existing else None
    }

    await conversations_collection.replace_one(
        {"chat_id": chat_id, "user_id": user_id},
        conversation_doc,
        upsert=True
    )

    return {
        "response": reply,
        "chat_id": chat_id,
        "history": messages
    }