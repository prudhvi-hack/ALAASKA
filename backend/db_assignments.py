from motor.motor_asyncio import AsyncIOMotorClient
from backend.db_mongo import db, mongo_client
from pymongo import ASCENDING, DESCENDING
import logging

logger = logging.getLogger(__name__)

# Collections
templates_collection = db["assignment_templates"]
assignments_collection = db["assignments"]
student_assignments_collection = db["student_assignments"]

quiz_templates_collection = db["quiz_templates"]
student_quiz_responses_collection = db["student_quiz_responses"]

async def create_assignment_indexes():
    """Create indexes for assignment collections"""
    try:
        # Index for templates
        await templates_collection.create_index("template_id", unique=True)
        await templates_collection.create_index("created_by")
        
        # Index for assignments
        await assignments_collection.create_index("assignment_id", unique=True)
        await assignments_collection.create_index("template_id")
        await assignments_collection.create_index("allowed_students")
        await assignments_collection.create_index("created_by")
        
        # Index for student assignments
        await student_assignments_collection.create_index(
            [("assignment_id", 1), ("student_email", 1)], 
            unique=True
        )
        await student_assignments_collection.create_index("student_email")
        await student_assignments_collection.create_index("assignment_id")
        
        print("Assignment indexes created successfully")
    except Exception as e:
        print(f"Error creating assignment indexes: {e}")