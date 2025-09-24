import os
import asyncio
import csv
from datetime import datetime
from db_mongo import initialize_database, conversations_collection, users_collection, messages_collection

async def export_conversations_to_csv(export_folder):
    conversations = await conversations_collection.find().sort("email", 1).to_list(None)
    
    filename = f"conversations_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['chat_id', 'auth0_id', 'username', 'email', 'summary', 'status', 'created_at', 'updated_at']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for conv in conversations:
            if 'created_at' in conv:
                conv['created_at'] = conv['created_at'].isoformat() if conv['created_at'] else ''
            if 'updated_at' in conv:
                conv['updated_at'] = conv['updated_at'].isoformat() if conv['updated_at'] else ''
            
            writer.writerow({field: conv.get(field, '') for field in fieldnames})
    
    print(f"Exported {len(conversations)} conversations to {filepath}")

async def export_users_to_csv(export_folder):
    users = await users_collection.find().sort("email", 1).to_list(None)
    
    filename = f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['auth0_id', 'username', 'email', 'created_at']
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
        fieldnames = ['chat_id', 'auth0_id', 'username', 'email', 'role', 'content', 'timestamp']
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
    await export_users_to_csv(export_folder)
    await export_messages_to_csv(export_folder)
    
    print(f"All exports completed in folder: {folder_name}")

# Run all exports
asyncio.run(export_all_data())