from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

class Question(BaseModel):
    question_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: Optional[str] = None
    question_text: Optional[str] = None  # Keep for backward compatibility
    prompt_md: str = Field(..., description="Markdown for the question body")
    marks: float = Field(default=0, ge=0, description="Marks allotted for the question")
    hints: Optional[List[str]] = []
    
    # Chat tracking
    chat_id: Optional[str] = None  # Current active chat
    old_chats: List[str] = []  # Array of archived chat IDs
    
    # Student submission
    student_solution: Optional[str] = None  # Text of the submitted answer
    submitted_chat_id: Optional[str] = None  # Which chat the answer is from
    submitted_message_index: Optional[int] = None  # Which message in that chat
    submitted_at: Optional[str] = None  # ISO timestamp of submission
    
    # Grading
    is_correct: Optional[bool] = None  # True/False/None (pending)
    feedback: Optional[str] = None  # Instructor feedback
    attempts: int = 0  # Number of times submitted


class MCQOption(BaseModel):
    option_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    is_correct: bool = False

class MCQQuestion(BaseModel):
    question_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_text: str
    options: List[MCQOption] = Field(..., min_length=2)
    explanation: Optional[str] = None  # Shown after answering


class QuizTemplate(BaseModel):
    quiz_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    questions: List[MCQQuestion]


class CreateQuizTemplateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    questions: List[MCQQuestion]


class UpdateQuizTemplateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    questions: List[MCQQuestion]

class SubmitQuizAnswerRequest(BaseModel):
    question_id: str
    selected_option_id: str

class SubmissionSnapshot(BaseModel):
    submission_number: int
    submitted_at: str
    questions_answered: int
    total_questions: int
    answers: List[dict]  # Snapshot of answers at submission time

class AssignmentUpsert(BaseModel):
    title: str
    due_date: Optional[str] = None
    instructions_md: Optional[str] = ""
    questions: List[Question]
    students: List[str] = []

class CreateTemplateRequest(BaseModel):
    title: str
    description: str
    questions: List[Question]

class UpdateTemplateRequest(BaseModel):
    title: str
    description: str
    questions: List[Question]

class CreateAssignmentRequest(BaseModel):
    template_id: str
    allowed_students: List[str]
    pre_quiz_id: Optional[str] = None
    post_quiz_id: Optional[str] = None

class MarkSolutionRequest(BaseModel):
    solution: str
    is_correct: bool

class SubmitAnswerRequest(BaseModel):
    chat_id: str
    message_index: int
    message_content: str


class SubmitAssignmentRequest(BaseModel):
    pass  # No body needed, just triggers submission

class UpdateSubmissionSettingsRequest(BaseModel):
    submissions_enabled: bool
    submission_exceptions: List[str] = []  # Emails allowed when disabled