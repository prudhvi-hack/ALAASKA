from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from openai import OpenAI
import yaml
import os
import json
import csv
import uuid

# ========== ENV SETUP ==========
from dotenv import load_dotenv
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("Missing OPENAI_API_KEY in .env")

client = OpenAI(api_key=OPENAI_API_KEY)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
MODEL_ID = os.getenv("MODEL_ID")
ACCESS_TOKEN_EXPIRE_MINUTES = 60

USER_DB_FILE = "users.yaml"
CONVERSATION_DIR = "conversations"
os.makedirs(CONVERSATION_DIR, exist_ok=True)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust to your frontend origin for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== MODELS ==========
class User(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ChatRequest(BaseModel):
    message: str
    chat_id: str | None = None

# ========== UTILS ==========
def load_users():
    if not os.path.exists(USER_DB_FILE):
        return {"users": {}}
    with open(USER_DB_FILE, "r") as f:
        data = yaml.safe_load(f) or {}
    if "users" not in data:
        data["users"] = {}
    return data

def save_users(data):
    with open(USER_DB_FILE, "w") as f:
        yaml.dump(data, f)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401, detail="Could not validate credentials"
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception

def get_user_dir(username):
    path = os.path.join(CONVERSATION_DIR, username)
    os.makedirs(path, exist_ok=True)
    return path

def summarize_prompt(text):
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Give a 4-word title to this message"},
            {"role": "user", "content": text}
        ],
        temperature=0.3
    )
    return response.choices[0].message.content.strip().strip('"')

def append_to_csv(username, chat_id, summary, messages_to_append):
    user_dir = get_user_dir(username)
    csv_path = os.path.join(user_dir, "conversations.csv")

    write_header = not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0

    with open(csv_path, "a", newline='', encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        if write_header:
            writer.writerow(["username", "chat_id", "summary", "timestamp", "role", "message"])
        for msg in messages_to_append:
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
            writer.writerow([username, chat_id, summary, timestamp, msg["role"], msg["content"]])

# ========== AUTH ENDPOINTS ==========
@app.post("/register")
def register(user: User):
    db = load_users()
    if user.username in db.get("users", {}):
        raise HTTPException(status_code=400, detail="Username already exists")

    if "users" not in db:
        db["users"] = {}

    db["users"][user.username] = {"password": get_password_hash(user.password)}
    save_users(db)
    return {"message": "User registered successfully"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = load_users()
    user_record = db["users"].get(form_data.username)
    if not user_record or not verify_password(form_data.password, user_record["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(
        data={"sub": form_data.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ========== CHAT ENDPOINT ==========
@app.post("/chat/start")
def start_chat(username: str = Depends(get_current_user)):
    user_dir = get_user_dir(username)
    chat_id = f"{uuid.uuid4().hex[:8]}.json"
    path = os.path.join(user_dir, chat_id)

    assistant_welcome = {"role": "assistant", "content": "Hi! Welcome to ALAASKA. How can I help you today?"}

    messages = [assistant_welcome]
    json.dump(messages, open(path, "w"), indent=2)

    return {"response": assistant_welcome["content"], "chat_id": chat_id, "history": messages}

@app.post("/chat")
def chat(req: ChatRequest, username: str = Depends(get_current_user)):
    user_dir = get_user_dir(username)

    system_message = {
    "role": "system",
    "content": (
        "You are ALAASKA, a supportive tutor. Your job is to guide the user to think critically and find the solution on their own."
        "Identify the student's level with guiding questions and avoid giving the final solution."
        "When appropriate throughout the conversation use these: flashcards, mini quizzes, scenarios."
        "Only focus on academic discussions."
    )
}

    if req.chat_id:
        path = os.path.join(user_dir, req.chat_id)
        messages = json.load(open(path)) if os.path.exists(path) else []

        meta_path = path.replace(".json", "_meta.json")
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            summary = meta.get("summary", "")
        else:
            summary = ""
    else:
        chat_id = f"{uuid.uuid4().hex[:8]}.json"
        path = os.path.join(user_dir, chat_id)
        assistant_welcome = {"role": "assistant", "content": "Hi! Welcome to ALAASKA How can I help you today?"}
        messages = [assistant_welcome]
        summary = ""

    api_messages = [system_message] + messages

    messages.append({"role": "user", "content": req.message})

    # Generate summary on first user message if needed
    if summary == "" and len(messages) == 2:  # assistant + user
        summary = summarize_prompt(req.message)
        meta = {
            "summary": summary,
            "created_at": datetime.utcnow().strftime("%H:%M on %d-%m-%Y")
        }
        meta_path = path.replace(".json", "_meta.json")
        with open(meta_path, "w") as f:
            json.dump(meta, f)

    response = client.chat.completions.create(
        model= MODEL_ID, #"gpt-4o"
        messages=api_messages + [{"role": "user", "content": req.message}],
        temperature=0.7
    )

    reply = response.choices[0].message.content
    messages.append({"role": "assistant", "content": reply})

    append_to_csv(username, os.path.basename(path), summary, messages[-2:])
    json.dump(messages, open(path, "w"), indent=2)

    return {"response": reply, "chat_id": os.path.basename(path), "history": messages}

# ========== CONVERSATION MGMT ==========
@app.get("/conversations")
def list_conversations(username: str = Depends(get_current_user)):
    user_dir = get_user_dir(username)
    chat_files = [f for f in os.listdir(user_dir) if f.endswith(".json") and not f.endswith("_meta.json")]
    conversations = []
    for f in chat_files:
        meta_path = os.path.join(user_dir, f.replace(".json", "_meta.json"))
        if os.path.exists(meta_path):
            with open(meta_path) as mf:
                meta = json.load(mf)
            conversations.append({
                "chat_id": f,
                "summary": meta.get("summary", f[:8]),
                "created_at": meta.get("created_at", "")
            })
        else:
            conversations.append({
                "chat_id": f,
                "summary": f[:8],
                "created_at": ""
            })
    return conversations

@app.get("/conversation/{chat_id}")
def get_conversation(chat_id: str, username: str = Depends(get_current_user)):
    path = os.path.join(get_user_dir(username), chat_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return json.load(open(path))

@app.delete("/conversation/{chat_id}")
def delete_conversation(chat_id: str, username: str = Depends(get_current_user)):
    path = os.path.join(get_user_dir(username), chat_id)
    if os.path.exists(path):
        os.remove(path)
        return {"message": "Deleted"}
    raise HTTPException(status_code=404, detail="Not found")



