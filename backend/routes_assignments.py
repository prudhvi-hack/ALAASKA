from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user, http_bearer
from fastapi.security import HTTPAuthorizationCredentials
from backend.admin import require_admin
from backend.models_assignments import (
    CreateTemplateRequest, 
    CreateAssignmentRequest, 
    MarkSolutionRequest,
    SubmitAnswerRequest,
    Question
)
from backend.db_assignments import (
    templates_collection,
    assignments_collection,
    student_assignments_collection
)
from backend.db_mongo import conversations_collection, users_collection
from datetime import datetime, timezone
import uuid
from fastapi.responses import StreamingResponse
from backend.pdf_generator import create_gradescope_pdf

router = APIRouter()

# ========== HELPER FUNCTION ==========

def create_assignment_system_prompt(question_number: str, question_text: str, hints: list = None) -> list:
    """
    Create initial messages for an assignment question chat.
    
    Returns list of [system_message, assistant_greeting]
    """
    hints_text = ""
    if hints and len(hints) > 0:
        hints_text = "\n\nAvailable hints for this question:\n" + "\n".join([f"- {hint}" for hint in hints])
    
    return [
        {
            "role": "system",
            "content": (
                "You are ALAASKA, a supportive teaching assistant. Your job is to guide the user to think critically and find the solution on their own. "
                "Keep the conversation going with a question at the end your replies. "
                "Identify the student's level with guiding questions about the topic they are inquiring about. "
                "When appropriate throughout the conversation use these: flashcards, mini quizzes, scenarios, hints. "
                "Discuss only academic topics and nothing else."
                f"\n\nThe student needs to solve this assignment question:\n\nQuestion {question_number}: {question_text}{hints_text}"
            )
        },
        {
            "role": "assistant",
            "content": f"""Hi! I'm here to help you work through this assignment question:

**Question {question_number}:** {question_text}

Before we dive in, I'd like to understand your initial thoughts. What's your first impression of this question? What concepts or ideas come to mind when you read it?

Take your time - there's no rush. Let's work through this together! 🎯"""
        }
    ]

# ========== ADMIN ROUTES ==========

@router.post("/assignment-templates")
async def create_assignment_template(
    request: CreateTemplateRequest, 
    user: dict = Depends(require_admin)
):
    """Create a new assignment template (admin only)"""
    template_id = str(uuid.uuid4())
    
    template_doc = {
        "template_id": template_id,
        "title": request.title,
        "description": request.description,
        "questions": [
            {
                "question_id": str(uuid.uuid4()),
                "number": q.number,
                "prompt_md": q.prompt_md,
                "marks": float(q.marks),
                "hints": q.hints or []
            }
            for q in request.questions
        ],
        "created_by": user["email"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await templates_collection.insert_one(template_doc)
    
    return {
        "message": "Template created successfully",
        "template_id": template_id
    }

@router.get("/assignment-templates")
async def get_assignment_templates(user: dict = Depends(require_admin)):
    """Get all assignment templates (admin only)"""
    cursor = templates_collection.find({}, {"_id": 0})
    templates = []
    async for template in cursor:
        templates.append(template)
    return {"templates": templates}

@router.post("/assignments")
async def create_assignment(
    request: CreateAssignmentRequest, 
    user: dict = Depends(require_admin)
):
    """Create a new assignment from a template (admin only)"""
    # Get the template
    template = await templates_collection.find_one({"template_id": request.template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    assignment_id = str(uuid.uuid4())
    
    # Create assignment
    assignment_doc = {
        "assignment_id": assignment_id,
        "template_id": request.template_id,
        "title": template["title"],
        "description": template["description"],
        "questions": template["questions"],  # Contains number, prompt_md, marks, hints
        "allowed_students": [email.lower() for email in request.allowed_students],
        "created_by": user["email"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await assignments_collection.insert_one(assignment_doc)
    
    return {
        "message": "Assignment created successfully",
        "assignment_id": assignment_id
    }

@router.get("/admin/assignments")
async def get_all_assignments(user: dict = Depends(require_admin)):
    """Get all assignments (admin only)"""
    cursor = assignments_collection.find({}, {"_id": 0})
    assignments_list = []
    async for assignment in cursor:
        assignments_list.append({
            "assignment_id": assignment["assignment_id"],
            "template_id": assignment["template_id"],
            "title": assignment["title"],
            "description": assignment["description"],
            "allowed_students": assignment.get("allowed_students", []),
            "created_by": assignment["created_by"],
            "created_at": assignment["created_at"].isoformat()
        })
    return {"assignments": assignments_list}

@router.put("/assignments/{assignment_id}/students")
async def update_assignment_students(
    assignment_id: str,
    request: dict,
    user: dict = Depends(require_admin)
):
    """Update the allowed students list for an assignment (admin only)"""
    allowed_students = request.get("allowed_students", [])
    if not allowed_students:
        raise HTTPException(status_code=400, detail="Must provide at least one student email")
    
    # Normalize emails
    allowed_students = [email.lower().strip() for email in allowed_students]
    
    result = await assignments_collection.update_one(
        {"assignment_id": assignment_id},
        {"$set": {"allowed_students": allowed_students}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return {
        "message": "Assignment updated successfully",
        "assignment_id": assignment_id,
        "total_students": len(allowed_students)
    }




# Update the export_assignment_pdf function

@router.post("/assignments/{assignment_id}/export-pdf")
async def export_assignment_pdf(
    assignment_id: str,
    user: dict = Depends(require_admin)
):
    """Export assignment submissions as Gradescope-compatible PDF (admin only)"""
    try:
        # Get assignment details
        assignment = await assignments_collection.find_one({"assignment_id": assignment_id})
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        # Get all student submissions
        cursor = student_assignments_collection.find(
            {"assignment_id": assignment_id},
            {"_id": 0}
        )
        
        students_data = []
        async for student_assignment in cursor:
            # Get student details
            user_doc = await users_collection.find_one({"email": student_assignment["student_email"]})
            
            student_name = user_doc.get("username", "Unknown") if user_doc else "Unknown"
            student_email = student_assignment["student_email"]
            
            # Process questions - include chat_id ✅
            questions_data = []
            for question in student_assignment["questions"]:
                questions_data.append({
                    "number": question.get("number", "?"),
                    "marks": question.get("marks", 0),
                    "student_solution": question.get("student_solution"),
                    "chat_id": question.get("chat_id")  # ✅ NEW
                })
            
            students_data.append({
                "name": student_name,
                "email": student_email,
                "questions": questions_data
            })
        
        if not students_data:
            raise HTTPException(status_code=404, detail="No submissions found for this assignment")
        
        # ✅ Get base URL from environment or use default
        from backend.config import FRONTEND_URL
        base_url = FRONTEND_URL if hasattr(FRONTEND_URL, '__str__') else "http://localhost:3000"
        
        # Generate PDF with base_url
        pdf_buffer = create_gradescope_pdf(
            assignment_title=assignment["title"],
            students_data=students_data,
            base_url=base_url  # ✅ NEW
        )
        
        # Create filename
        safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in assignment["title"])
        filename = f"{safe_title}_submissions.pdf"
        
        # Return as streaming response
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating PDF: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")# ========== STUDENT ROUTES ==========

@router.get("/assignments")
async def get_student_assignments(auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get all assignments for the current student"""
    user = await get_current_user(auth)
    user_email = user["email"].lower()
    
    # Find assignments where this student is allowed
    cursor = assignments_collection.find(
        {"allowed_students": user_email},
        {"_id": 0}
    )
    
    student_assignments = []
    async for assignment in cursor:
        # Check if student has accepted this assignment
        student_record = await student_assignments_collection.find_one({
            "assignment_id": assignment["assignment_id"],
            "student_email": user_email
        })
        
        student_assignments.append({
            "assignment_id": assignment["assignment_id"],
            "title": assignment["title"],
            "description": assignment["description"],
            "total_questions": len(assignment["questions"]),
            "accepted": student_record is not None,
            "accepted_at": student_record["accepted_at"].isoformat() if student_record else None
        })
    
    return {"assignments": student_assignments}

@router.post("/assignments/{assignment_id}/accept")
async def accept_assignment(assignment_id: str, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Accept an assignment and create conversation for each question"""
    user = await get_current_user(auth)
    user_email = user["email"].lower()
    user_id = user["auth0_id"]
    
    # Check if assignment exists and student is allowed
    assignment = await assignments_collection.find_one({"assignment_id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if user_email not in assignment.get("allowed_students", []):
        raise HTTPException(status_code=403, detail="You are not allowed to access this assignment")
    
    # Check if already accepted
    existing = await student_assignments_collection.find_one({
        "assignment_id": assignment_id,
        "student_email": user_email
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already accepted")
    
    # Create a conversation for each question
    questions_with_chats = []
    for idx, q in enumerate(assignment["questions"]):
        chat_id = str(uuid.uuid4())
        
        question_number = q.get('number', str(idx + 1))
        question_text = q.get('prompt_md', '')
        question_marks = q.get('marks', 0)
        
        # ✅ Use helper function
        initial_messages = create_assignment_system_prompt(
            question_number=question_number,
            question_text=question_text,
            hints=q.get("hints", [])
        )
        
        # Create conversation document
        conversation_doc = {
            "chat_id": chat_id,
            "user_id": user_id,
            "messages": initial_messages,
            "summary": f"{assignment['title']} - Q{question_number}",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_deleted": False,
            "assignment_id": assignment_id,
            "question_id": q["question_id"],
            "is_assignment_chat": True
        }
        
        await conversations_collection.insert_one(conversation_doc)
        
        # Add question with chat_id
        questions_with_chats.append({
            "question_id": q["question_id"],
            "number": question_number,
            "prompt_md": question_text,
            "marks": question_marks,
            "hints": q.get("hints", []),
            "chat_id": chat_id,
            "old_chats": [],  # ✅ Initialize empty array
            "student_solution": None,
            "submitted_chat_id": None,
            "submitted_message_index": None,
            "submitted_at": None,
            "is_correct": None,
            "attempts": 0
        })
    
    # Create student assignment record
    student_assignment = {
        "assignment_id": assignment_id,
        "student_email": user_email,
        "accepted_at": datetime.now(timezone.utc),
        "questions": questions_with_chats
    }
    
    await student_assignments_collection.insert_one(student_assignment)
    
    return {
        "message": "Assignment accepted successfully",
        "conversations_created": len(questions_with_chats)
    }

@router.get("/assignments/{assignment_id}")
async def get_assignment_details(assignment_id: str, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get assignment details with student's progress"""
    user = await get_current_user(auth)
    user_email = user["email"].lower()
    
    # Get student's assignment record
    student_assignment = await student_assignments_collection.find_one(
        {
            "assignment_id": assignment_id,
            "student_email": user_email
        },
        {"_id": 0}
    )
    
    if not student_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not accepted")
    
    # Get assignment details
    assignment = await assignments_collection.find_one(
        {"assignment_id": assignment_id},
        {"_id": 0, "allowed_students": 0}
    )
    
    return {
        "assignment_id": assignment_id,
        "title": assignment["title"],
        "description": assignment["description"],
        "questions": student_assignment["questions"],
        "accepted_at": student_assignment["accepted_at"].isoformat()
    }

@router.get("/assignments/{assignment_id}/questions/{question_id}/chat")
async def get_question_chat(
    assignment_id: str,
    question_id: str,
    reset: bool = False,
    auth: HTTPAuthorizationCredentials = Depends(http_bearer)
):
    """Get or create chat for a specific question. If reset=True, archive old chat and create new one."""
    user = await get_current_user(auth)
    user_email = user["email"].lower()
    user_id = user["auth0_id"]
    
    # Get student assignment
    student_assignment = await student_assignments_collection.find_one({
        "assignment_id": assignment_id,
        "student_email": user_email
    })
    
    if not student_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not accepted")
    
    # Find the question
    question_index = -1
    target_question = None
    
    for idx, question in enumerate(student_assignment["questions"]):
        if question["question_id"] == question_id:
            question_index = idx
            target_question = question
            break
    
    if target_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Handle reset: move old chat to old_chats array
    if reset and target_question.get("chat_id"):
        old_chat_id = target_question["chat_id"]
        
        # Initialize old_chats array if not exists
        if "old_chats" not in target_question:
            target_question["old_chats"] = []
        
        # Add old chat to old_chats array
        target_question["old_chats"].append(old_chat_id)
        
        # Clear current chat_id to force creation of new one
        target_question["chat_id"] = None
        
        # Reset submission data
        target_question["attempts"] = 0
        target_question["student_solution"] = None
        target_question["submitted_chat_id"] = None
        target_question["submitted_message_index"] = None
        target_question["submitted_at"] = None
        target_question["is_correct"] = None
        
        # Update in database
        await student_assignments_collection.update_one(
            {
                "assignment_id": assignment_id,
                "student_email": user_email
            },
            {
                "$set": {
                    f"questions.{question_index}": target_question
                }
            }
        )
    
    # If chat already exists (and not resetting), return it
    if target_question.get("chat_id"):
        existing_chat = await conversations_collection.find_one({
            "chat_id": target_question["chat_id"]
        })
        
        if existing_chat:
            return {
                "chat_id": target_question["chat_id"],
                "created": False,
                "reset": False
            }
    
    # Create new chat (for reset or if missing)
    new_chat_id = str(uuid.uuid4())
    
    question_number = target_question.get('number', str(question_index + 1))
    question_text = target_question.get('prompt_md', '')
    
    # ✅ Use helper function
    initial_messages = create_assignment_system_prompt(
        question_number=question_number,
        question_text=question_text,
        hints=target_question.get("hints", [])
    )
    
    # Get assignment for summary
    assignment = await assignments_collection.find_one({"assignment_id": assignment_id})
    assignment_title = assignment["title"] if assignment else "Assignment"
    
    conversation_doc = {
        "chat_id": new_chat_id,
        "user_id": user_id,
        "messages": initial_messages,
        "summary": f"{assignment_title} - Q{question_number}",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False,
        "assignment_id": assignment_id,
        "question_id": question_id,
        "is_assignment_chat": True
    }
    
    await conversations_collection.insert_one(conversation_doc)
    
    # Update student assignment with new chat_id
    target_question["chat_id"] = new_chat_id
    student_assignment["questions"][question_index] = target_question
    
    await student_assignments_collection.update_one(
        {
            "assignment_id": assignment_id,
            "student_email": user_email
        },
        {
            "$set": {
                "questions": student_assignment["questions"]
            }
        }
    )
    
    return {
        "chat_id": new_chat_id,
        "created": True,
        "reset": reset
    }

@router.post("/assignments/{assignment_id}/questions/{question_id}/submit-answer")
async def submit_answer(
    assignment_id: str,
    question_id: str,
    request: SubmitAnswerRequest,
    auth: HTTPAuthorizationCredentials = Depends(http_bearer)
):
    """Submit a message as the final answer for a question"""
    user = await get_current_user(auth)
    user_email = user["email"].lower()
    
    # Get student assignment
    student_assignment = await student_assignments_collection.find_one({
        "assignment_id": assignment_id,
        "student_email": user_email
    })
    
    if not student_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not accepted")
    
    # Find the question
    question_index = -1
    target_question = None
    
    for idx, question in enumerate(student_assignment["questions"]):
        if question["question_id"] == question_id:
            question_index = idx
            target_question = question
            break
    
    if target_question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify the chat belongs to this question (current or old)
    valid_chat_ids = [target_question.get("chat_id")] + target_question.get("old_chats", [])
    valid_chat_ids = [cid for cid in valid_chat_ids if cid]
    
    if request.chat_id not in valid_chat_ids:
        raise HTTPException(status_code=400, detail="Chat does not belong to this question")
    
    # Verify the message exists in the specified chat
    chat = await conversations_collection.find_one({
        "chat_id": request.chat_id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = chat.get("messages", [])
    selected_message = None
    actual_index = -1
    
    for idx, msg in enumerate(messages):
        if msg.get("role") == "user" and msg.get("content") == request.message_content:
            selected_message = msg
            actual_index = idx
            break
    
    if selected_message is None:
        raise HTTPException(status_code=400, detail="Message not found or not a user message")
    
    # Update the question with the submitted answer
    target_question["student_solution"] = request.message_content
    target_question["submitted_chat_id"] = request.chat_id
    target_question["submitted_message_index"] = actual_index
    target_question["submitted_at"] = datetime.now(timezone.utc).isoformat()
    target_question["attempts"] = target_question.get("attempts", 0) + 1
    
    # Update in database
    await student_assignments_collection.update_one(
        {
            "assignment_id": assignment_id,
            "student_email": user_email
        },
        {
            "$set": {
                f"questions.{question_index}": target_question
            }
        }
    )
    
    return {
        "message": "Answer submitted successfully",
        "submitted_at": target_question["submitted_at"],
        "chat_id": request.chat_id,
        "message_index": actual_index,
        "attempts": target_question["attempts"]
    }

@router.get("/assignments/{assignment_id}/chats")
async def get_assignment_chats(assignment_id: str, auth: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Get all chat sessions for this assignment"""
    user = await get_current_user(auth)
    user_email = user["email"].lower()
    
    # Get student's assignment record
    student_assignment = await student_assignments_collection.find_one({
        "assignment_id": assignment_id,
        "student_email": user_email
    })
    
    if not student_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or not accepted")
    
    # Return questions with their chat histories
    chats = []
    for question in student_assignment.get("questions", []):
        chats.append({
            "question_id": question["question_id"],
            "number": question.get("number", ""),
            "prompt_md": question.get("prompt_md", ""),
            "chat_id": question.get("chat_id")
        })
    
    return {"chats": chats}