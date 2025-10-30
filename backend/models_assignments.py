from pydantic import BaseModel, Field
from typing import List, Optional

class Question(BaseModel):
    number: str = Field(..., description="Question number label, e.g., '1', '1.1', '2.3'")
    prompt_md: str = Field(..., description="Markdown for the question body")
    marks: float = Field(..., ge=0, description="Marks allotted for the question")
    hints: Optional[List[str]] = []

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

class CreateAssignmentRequest(BaseModel):
    template_id: str
    allowed_students: List[str]

class MarkSolutionRequest(BaseModel):
    solution: str
    is_correct: bool