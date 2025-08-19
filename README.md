# ALAASKA Quick Deployment Guide

## 📋 Table of Contents
- [Overview](#overview)
- [1. Prerequisistes](#1-prerequisites)
- [2. Quick Setup ](#2-quick-setup)
  - [2.1 Install Dependencies](#21-install-dependencies)
  - [2.2 Clone and Setup Application](#22-clone-and-setup-application)
  - [2.3 Configure Environment Variables](#23-configure-environment-variables)
  - [2.4 Configure Firewall](#24-configure-firewall)
  - [2.5 Start Application (Testing)](#25-start-application-testing)
- [3. Production Setup](#3-production-setup)
- [4. Required Manual Steps](#4-required-manual-steps)
- [5. Verification](#5-verification)
- [6. Troubleshooting](#6-troubleshooting)
- [7. Dependencies](#7-dependencies)
- [8. Final Result](#8-final-result)

---

## Overview
**ALAASKA** (Adaptive Learning for All through AI-Powered Student Knowledge Assessment) is a full-stack web application that delivers intelligent, personalized tutoring experiences powered by a fine-tuned language model. Designed with a strong pedagogical foundation, ALAASKA simulates the behavior of a supportive tutor who uses microlearning materials like flashcards, guiding questions, and mini-quizzes to promote intuitive problem solving and learner autonomy. 

### UI Overview
<img src="https://github.com/Bonam-M/ALAASKA/blob/main/frontend/src/assets/alaaska-screenshot.png" alt="Platform Overview" width="600" />
<br>

The system supports persistent multi-session tutoring through a sidebar-based conversation manager, markdown-rendered messaging, and token-authenticated communication between the client and server. Users can log in, manage their past conversations, and engage in real-time learning conversations with the model. ALAASKA is a research project that can serves as a framework for researchers, educators, or developers building AI-powered adaptive learning tools with pedagogical constraints.  
<br>

### Implementation Overview
ALAASKA is built with:
- **Frontend**: React 18.3.1
- **Backend**: FastAPI with Python 3.10.16
- **Database**: MongoDB Community Edition 7.0
- **AI**: OpenAI GPT integration
- **Authentication**: Auth0 

---

## 1. Prerequisites

### Required Software Versions
- **Node.js**: v24.4.1
- **npm**: 11.4.2
- **Python**: 3.10.16
- **MongoDB**: Community Edition 7.0

### Required Environment Variables
You will need the following:
- OPENAI_API_KEY=[To be provided], MODEL_ID=[To be provided], SUMMARIZE_MODEL_ID=[To be provided]
- MONGODB_URL=[Local instance to be defined], MONGODB_CLIENT=[Database name to be defined]
- AUTH0_DOMAIN=[To be provided], AUTH0_CLIENT_ID=[To be provided], AUTH0_API_AUDIENCE=[To be provided]
- ALGORITHM=[To be provided]
- BACKEND_URL=[To be defined], FRONTEND_UR=[To be defined], Backend SECRET_KEY=[To be defined]

---

## 2. Quick Setup (30 minutes)

### 2.1 Install Software Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js v24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.10 and pip
sudo apt install -y python3.10 python3.10-venv python3-pip

# Install MongoDB 7.0
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod && sudo systemctl enable mongod
```

### 2.2 Clone and Setup Application
```bash
# Clone repository
git clone YOUR_REPO_URL alaaska_app
cd alaaska_app

# Setup Backend
cd backend
python3.10 -m venv alaaska_env
source alaaska_env/bin/activate
pip install -r requirements.txt

# Setup Frontend  
cd ../frontend
npm install
```

### 2.3 Configure Environment Variables

**Backend create (.env) file:**
```bash
cd backend
cat > .env << 'EOF'
MONGODB_URL=mongodb://YOUR_SERVER_IP:27017 [OR To be defined]
MONGODB_CLIENT=alaaska_db [OR To be defined]
OPENAI_API_KEY=your_openai_key_here [To be provided]
MODEL_ID=[To be provided]
SUMMARIZE_MODEL_ID=[To be provided]
AUTH0_DOMAIN=your_domain.auth0.com [To be provided]
AUTH0_CLIENT_ID=[To be provided]
AUTH0_API_AUDIENCE=your_api_audience [To be provided]
ALGORITHM=RS256
SECRET_KEY=generate_64_char_random_string_here
FRONTEND_URL=http://YOUR_SERVER_IP:3000
BACKEND_URL=http://YOUR_SERVER_IP:8000
EOF
```

**Frontend (.env):**
```bash
cd ../frontend  
cat > .env << 'EOF'
REACT_APP_AUTH0_DOMAIN=your_domain.auth0.com [To be provided]
REACT_APP_AUTH0_CLIENT_ID=your_client_id_here [To be provided]
REACT_APP_AUTH0_API_AUDIENCE=your_api_audience [To be provided]
REACT_APP_API_URL=http://YOUR_SERVER_IP:8000
```

### 2.4 Configure Firewall
```bash
sudo ufw enable
sudo ufw allow 22,80,443,3000,8000/tcp
sudo ufw deny 27017  # MongoDB internal only
```

### 2.5 Start Application (Testing)
```bash
# Terminal 1 - Backend
cd alaaska_app
source alaaska_env/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend  
cd alaaska_app/frontend
npm start
```

**Test URLs:**
- Frontend: `http://YOUR_SERVER_IP:3000`
- Backend API: `http://YOUR_SERVER_IP:8000/docs`

---

## 3. Production Setup (RECOMMENDED)

### Create Services
```bash
# Backend Service
sudo tee /etc/systemd/system/alaaska-backend.service << 'EOF'
[Unit]
Description=ALAASKA Backend
After=network.target mongod.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD/backend
Environment=PATH=$PWD/backend/alaaska_env/bin
ExecStart=$PWD/backend/alaaska_env/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Frontend Service
sudo tee /etc/systemd/system/alaaska-frontend.service << 'EOF'
[Unit]
Description=ALAASKA Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD/frontend
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable --now alaaska-backend alaaska-frontend
```

---

## 4. Required Manual Steps

### 4.1 Update Environment Variables
Replace all placeholders with actual values:
- `YOUR_SERVER_IP` → Server IP address
- `your_openai_key_here` → OpenAI API key
- `your_domain.auth0.com` → Auth0 domain
- `your_client_id_here` → Auth0 client ID  
- `your_api_audience` → Auth0 API audience
- `generate_64_char_random_string_here` → Generate with: `openssl rand -hex 32`

### 4.2 Auth0 Configuration
In Auth0 dashboard, set:
- **Allowed Callback URLs**: `PROD FRONTEND AND BACKEND URLS`
- **Allowed Web Origins**: `PROD FRONTEND AND BACKEND URLS`
- **Allowed Logout URLs**: `PROD FRONTEND AND BACKEND URLS`

---

## 5. Verification

```bash
# Check services
sudo systemctl status mongod alaaska-backend alaaska-frontend

# Test endpoints
curl http://localhost:3000        # Frontend
curl http://localhost:8000/docs   # Backend API

# Check logs if issues
sudo journalctl -u alaaska-backend -f
sudo journalctl -u alaaska-frontend -f
```

---

## 6. Troubleshooting (RECOMMENDED)

**Backend won't start:**
```bash
cd backend && source alaaska_env/bin/activate
python -c "import fastapi, motor, openai; print('Dependencies OK')"
```

**Frontend won't start:**
```bash
cd frontend
rm -rf node_modules && npm install
```

**MongoDB issues:**
```bash
sudo systemctl restart mongod
mongosh --eval "db.adminCommand('ping')"
```

**Port conflicts:**
```bash
sudo lsof -i :3000  # Check what's using port 3000
sudo lsof -i :8000  # Check what's using port 8000
```

---

## 7. Dependencies

**Backend (requirements.txt):**
- fastapi==0.115.12
- uvicorn==0.34.2
- motor==3.7.1
- openai==1.77.0
- [see requirements.txt for complete list]

**Frontend (package.json):**
- react@18.3.1
- @auth0/auth0-react@2.4.0
- axios@1.11.0
- [see package.json for complete list]

---

## 8. Final Result

After setup, your app will be running at:
- **Frontend**: `http://YOUR_SERVER_IP:3000`
- **Backend**: `http://YOUR_SERVER_IP:8000`

**Total setup time**: ~30 minutes for testing, +15 minutes for production services.

> **Note**: This is a minimal setup for testing. For robust production, consider adding SSL, reverse proxy, and enhanced security measures.
