from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from backend.config import validate_environment
from backend.middleware import get_cors_middleware, add_security_headers, limit_request_size
from backend.db_mongo import initialize_database, close_connection
from backend.db_assignments import create_assignment_indexes
from backend.routes_chat import router as chat_router
from backend.routes_assignments import router as assignments_router
from backend.routes_admin import router as admin_router  # Make sure this is imported

# Validate environment variables
validate_environment()

# Set up logging
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await initialize_database()
        await create_assignment_indexes()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    yield
    
    # Shutdown
    try:
        await close_connection()
        logger.info("Database connection closed")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")

# Initialize FastAPI app
app = FastAPI(lifespan=lifespan)

# Add CORS middleware
cors_config = get_cors_middleware()
app.add_middleware(
    CORSMiddleware,
    **cors_config
)

# Add custom middleware
app.middleware("http")(add_security_headers)
app.middleware("http")(limit_request_size)

# Include routers - MAKE SURE admin_router is included
app.include_router(chat_router, tags=["chat"])
app.include_router(assignments_router, tags=["assignments"])
app.include_router(admin_router, tags=["admin"])  # This line must be present

@app.get("/")
async def root():
    return {"message": "ALAASKA API is running"}