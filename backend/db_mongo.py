# db_mongo.py
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import os
from dotenv import load_dotenv
import logging
import asyncio

# Configure logging
logger = logging.getLogger(__name__)

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
if not MONGODB_URL:
    raise ValueError("Missing MONGODB_URL in .env")

MONGODB_CLIENT = os.getenv("MONGODB_CLIENT")
if not MONGODB_CLIENT:
    raise ValueError("Missing MONGODB_CLIENT in .env")

# Create async client with better connection settings
try:
    mongo_client = AsyncIOMotorClient(
        MONGODB_URL,
        serverSelectionTimeoutMS=30000,  # 30 second timeout
        connectTimeoutMS=60000,  # 60 second connection timeout
        maxPoolSize=500,  # Maximum connections in pool
        retryWrites=True  # Enable retryable writes
    )
    logger.info("AsyncIOMotorClient initialized")
except Exception as e:
    logger.error(f"Failed to initialize MongoDB client: {e}")
    raise

# Use environment variable for database name
db = mongo_client[MONGODB_CLIENT]

# Collections
users_collection = db["users"]
conversations_collection = db["conversations"]
messages_collection = db["messages"]

async def test_connection():
    """Test the async MongoDB connection"""
    try:
        # Test the connection
        await mongo_client.admin.command('ping')
        logger.info("Successfully connected to MongoDB")
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return False

async def create_indexes():
    """Create database indexes for better performance"""
    try:
        # Users collection indexes
        await users_collection.create_index("auth0_id", unique=True)
        await users_collection.create_index("email")
        
        # Conversations collection indexes
        await conversations_collection.create_index([
            ("auth0_id", ASCENDING),
            ("updated_at", DESCENDING)
        ])
        await conversations_collection.create_index("chat_id", unique=True)
        await conversations_collection.create_index([
            ("auth0_id", ASCENDING),
            ("chat_id", ASCENDING)
        ], unique=True)
        
        # Messages collection indexes
        await messages_collection.create_index([
            ("chat_id", ASCENDING),
            ("timestamp", ASCENDING)
        ])
        await messages_collection.create_index("chat_id")
        await messages_collection.create_index("auth0_id")
        
        logger.info("Database indexes created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
        return False

async def get_db_stats():
    """Get database statistics for monitoring"""
    try:
        stats = await db.command("dbstats")
        return {
            "database": stats.get("db"),
            "collections": stats.get("collections"),
            "objects": stats.get("objects"),
            "dataSize": stats.get("dataSize"),
            "storageSize": stats.get("storageSize"),
        }
    except Exception as e:
        logger.error(f"Failed to get database stats: {e}")
        return None

async def check_connection():
    """Check if database connection is healthy"""
    try:
        await mongo_client.admin.command('ping')
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False

async def initialize_database():
    """Initialize database connection and indexes"""
    try:
        # Test connection
        connection_ok = await test_connection()
        if not connection_ok:
            raise ConnectionError("Failed to connect to MongoDB")
        
        # Create indexes
        await create_indexes()
        
        # Log database stats
        stats = await get_db_stats()
        if stats:
            logger.info(f"Database stats: {stats['collections']} collections, {stats['objects']} documents")
        
        logger.info("Database initialization completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

# Cleanup function for graceful shutdown
async def close_connection():
    """Close the MongoDB connection"""
    try:
        mongo_client.close()
        logger.info("MongoDB connection closed")
    except Exception as e:
        logger.error(f"Error closing MongoDB connection: {e}")