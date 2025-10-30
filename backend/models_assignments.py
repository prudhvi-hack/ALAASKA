from pydantic import BaseModel
from typing import List, Optional

class Question(BaseModel):
    question_text: str
    hints: Optional[List[str]] = []

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