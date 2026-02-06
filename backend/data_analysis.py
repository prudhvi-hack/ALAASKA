import os
import asyncio
import csv
from datetime import datetime
from db_mongo import initialize_database, conversations_collection, users_collection, messages_collection

"""
async def export_conversations_to_csv(export_folder):
    conversations = await conversations_collection.find().sort("email", 1).to_list(None)
    
    filename = f"conversations_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        #fieldnames = ['chat_id', 'auth0_id', 'username', 'email', 'summary', 'status', 'created_at', 'updated_at']
        fieldnames = ['chat_id', 'user_id', 'username', 'email', 'messages','summary', 'status', 'created_at', 'updated_at', 'is_deleted', 'is_assignment_chat', 'assignment_id', 'question_id', 'rag_homework_answers', 'rag_done']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for conv in conversations:
            if 'created_at' in conv:
                conv['created_at'] = conv['created_at'].isoformat() if conv['created_at'] else ''
            if 'updated_at' in conv:
                conv['updated_at'] = conv['updated_at'].isoformat() if conv['updated_at'] else ''
            
            writer.writerow({field: conv.get(field, '') for field in fieldnames})
    
    print(f"Exported {len(conversations)} conversations to {filepath}")
"""
async def export_conversations_to_csv(export_folder):
    # Configure these variables
    start_date = "2026-01-12"  # Set to None to disable (YYYY-MM-DD)
    end_date = "2026-02-06"    # Set to None to disable (YYYY-MM-DD)
    users_csv_path = "./users.csv"  # Set to None to disable
    
    query_filter = {}
    
    # Date range filter
    if start_date or end_date:
        query_filter['created_at'] = {}
        if start_date:
            query_filter['created_at']['$gte'] = datetime.strptime(start_date, '%Y-%m-%d') if isinstance(start_date, str) else start_date
        if end_date:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d') if isinstance(end_date, str) else end_date
            query_filter['created_at']['$lte'] = end_dt.replace(hour=23, minute=59, second=59)
    
    # User email filter
    if users_csv_path:
        with open(users_csv_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
            reader = csv.DictReader(f)
            user_emails = [row['student_email'].strip() for row in reader 
                          if row.get('student_email', '').strip() and row.get('group', '').strip() == 'B']
        if user_emails:
            query_filter['$or'] = [{'user_id': {'$in': user_emails}}, {'email': {'$in': user_emails}}]
    
    conversations = await conversations_collection.find(query_filter).sort("email", 1).to_list(None)
    
    filename = f"conversations_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['chat_id', 'user_id', 'username', 'email', 'messages', 'summary', 'status', 
                      'created_at', 'updated_at', 'is_deleted', 'is_assignment_chat', 'assignment_id', 
                      'question_id', 'rag_homework_answers', 'rag_done']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for conv in conversations:
            if 'created_at' in conv:
                conv['created_at'] = conv['created_at'].isoformat() if conv['created_at'] else ''
            if 'updated_at' in conv:
                conv['updated_at'] = conv['updated_at'].isoformat() if conv['updated_at'] else ''
            writer.writerow({field: conv.get(field, '') for field in fieldnames})
    
    print(f"Exported {len(conversations)} conversations to {filepath}")
    return filepath

async def export_users_to_csv(export_folder):
    users = await users_collection.find().sort("email", 1).to_list(None)
    
    filename = f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['auth0_id', 'user_id', 'username', 'email', 'created_at']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for user in users:
            if 'created_at' in user:
                user['created_at'] = user['created_at'].isoformat() if user['created_at'] else ''
            
            writer.writerow({field: user.get(field, '') for field in fieldnames})
    
    print(f"Exported {len(users)} users to {filepath}")

async def export_messages_to_csv(export_folder):
    messages = await messages_collection.find().sort("chat_id", 1).to_list(None)
    
    filename = f"messages_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['chat_id', 'auth0_id', 'user_id', 'username', 'email', 'role', 'content', 'timestamp']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for message in messages:
            if 'timestamp' in message:
                message['timestamp'] = message['timestamp'].isoformat() if message['timestamp'] else ''
            
            writer.writerow({field: message.get(field, '') for field in fieldnames})
    
    print(f"Exported {len(messages)} messages to {filepath}")

async def export_all_data():
    await initialize_database()
    
    # Create export folder with timestamp
    current_dir = os.getcwd()
    folder_name = f"database_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    export_folder = os.path.join(current_dir, folder_name)
    
    # Create the folder
    os.makedirs(export_folder, exist_ok=True)
    print(f"Created export folder: {export_folder}")
    
    # Export all collections to the folder
    await export_conversations_to_csv(export_folder)
    #await export_users_to_csv(export_folder)
    #await export_messages_to_csv(export_folder)
    
    print(f"All exports completed in folder: {folder_name}")

# Run all exports
asyncio.run(export_all_data())