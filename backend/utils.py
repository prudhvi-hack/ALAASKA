from fastapi import HTTPException
from openai import AsyncOpenAI
import re
from backend.config import OPENAI_API_KEY, SUMMARIZE_MODEL_ID

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

def validate_chat_id(chat_id: str):
    """Validate chat ID format"""
    if not re.match(r'^[a-f0-9]{8}$', chat_id):
        raise HTTPException(status_code=400, detail="Invalid chat ID format")

async def summarize_prompt(text: str) -> str:
    """Generate a short summary title for a message"""
    response = await client.chat.completions.create(
        model=SUMMARIZE_MODEL_ID,
        messages=[
            {"role": "system", "content": "Give a 4-word title to this message"},
            {"role": "user", "content": text}
        ],
        temperature=0.3
    )
    return response.choices[0].message.content.strip().strip('"')