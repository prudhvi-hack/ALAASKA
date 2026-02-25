import os
import asyncio
import csv
import ast
import json
import re
from datetime import datetime
from db_mongo import initialize_database, conversations_collection, users_collection, messages_collection

async def export_conversations_to_csv(export_folder):
    # Configure these variables
    start_date = "2026-02-10"  # Set to None to disable (YYYY-MM-DD)
    end_date = "2026-02-16"    # Set to None to disable (YYYY-MM-DD)
    users_csv_path = "./students.csv"  # Set to None to disable
    
    query_filter = {}
    
    # Date range filter
    if start_date or end_date:
        query_filter['created_at'] = {}
        if start_date:
            query_filter['created_at']['$gte'] = datetime.strptime(start_date, '%Y-%m-%d') if isinstance(start_date, str) else start_date
        if end_date:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d') if isinstance(end_date, str) else end_date
            query_filter['created_at']['$lte'] = end_dt.replace(hour=23, minute=59, second=59)
    
    # User email filter - build mapping from user_id to student_email
    users_id_csv = []
    user_to_email_map = {}  # Maps user_id -> student_email
    
    if users_csv_path:
        with open(users_csv_path, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                user_id_val = row.get('user_id', '').strip()
                group_val = row.get('group', '').strip()
                student_email_val = row.get('student_email', '').strip()
                
                # Changed from 'B' to 'Group B'
                if user_id_val and group_val == 'Group B':
                    users_id_csv.append(user_id_val)
                    user_to_email_map[user_id_val] = student_email_val
        
        print(f"DEBUG: Loaded {len(users_id_csv)} user IDs from CSV")
        print(f"DEBUG: First 3 user IDs: {users_id_csv[:3]}")
        
        if users_id_csv:
            query_filter['user_id'] = {'$in': users_id_csv}
    
    conversations = await conversations_collection.find(query_filter).sort("email", 1).to_list(None)
    
    filename = f"conversations_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['chat_id', 'user_id', 'student_email', 'summary', 'status', 'created_at', 'updated_at', 'messages', 
                     'is_deleted', 'is_assignment_chat', 'assignment_id', 
                     'question_id', 'rag_homework_answers', 'rag_done']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for conv in conversations:
            # Truncate system message content
            if 'messages' in conv and conv['messages']:
                try:
                    messages_list = conv['messages']
                    for msg in messages_list:
                        if isinstance(msg, dict) and msg.get('role') == 'system':
                            if 'content' in msg and msg['content']:
                                msg['content'] = msg['content'][:15] + "..."
                except Exception as e:
                    print(f"Error processing messages: {e}")
                    pass
            
            # Look up student_email from the mapping
            db_user_id = conv.get('user_id', '')
            conv['student_email'] = user_to_email_map.get(db_user_id, '')
            
            if 'created_at' in conv:
                conv['created_at'] = conv['created_at'].isoformat() if conv['created_at'] else ''
            if 'updated_at' in conv:
                conv['updated_at'] = conv['updated_at'].isoformat() if conv['updated_at'] else ''
            
            writer.writerow({field: conv.get(field, '') for field in fieldnames})
    
    print(f"Exported {len(conversations)} conversations to {filepath}")
    return filepath

async def export_students_usage_to_csv(export_folder):
    """
    Export student usage statistics aggregated by student for a weekly period.
    """
    # Configure these variables
    start_date = "2026-02-10"  # Set to None to disable (YYYY-MM-DD)
    end_date = "2026-02-16"    # Set to None to disable (YYYY-MM-DD)
    users_csv_path = "./students.csv"  # Set to None to disable
    
    query_filter = {}
    
    # Date range filter
    if start_date or end_date:
        query_filter['created_at'] = {}
        if start_date:
            query_filter['created_at']['$gte'] = datetime.strptime(start_date, '%Y-%m-%d') if isinstance(start_date, str) else start_date
        if end_date:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d') if isinstance(end_date, str) else end_date
            query_filter['created_at']['$lte'] = end_dt.replace(hour=23, minute=59, second=59)
    
    # Load user mapping from CSV
    users_id_csv = []
    user_to_email_map = {}  # Maps user_id -> student_email
    
    if users_csv_path:
        with open(users_csv_path, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id_val = row.get('user_id', '').strip()
                group_val = row.get('group', '').strip()
                student_email_val = row.get('student_email', '').strip()
                
                if user_id_val and group_val == 'Group B':
                    users_id_csv.append(user_id_val)
                    user_to_email_map[user_id_val] = student_email_val
        
        if users_id_csv:
            query_filter['user_id'] = {'$in': users_id_csv}
    
    # Fetch all conversations
    conversations = await conversations_collection.find(query_filter).sort("user_id", 1).to_list(None)
    
    print(f"DEBUG: Found {len(conversations)} conversations for usage analysis")
    
    # Aggregate data by user_id
    user_stats = {}  # Will store stats per user_id
    
    for conv in conversations:
        user_id = conv.get('user_id', '')
        if not user_id:
            continue
        
        # Initialize user stats if first conversation for this user
        if user_id not in user_stats:
            user_stats[user_id] = {
                'student_email': user_to_email_map.get(user_id, ''),
                'user_id': user_id,
                'conversations': [],  # List of conversation data
                'all_msg_counts': [],  # List of message counts per conversation
                'all_char_counts': []  # List of character counts per message (all messages)
            }
        
        # Count user messages and characters in this conversation
        user_messages = []
        if 'messages' in conv and conv['messages']:
            for msg in conv['messages']:
                if isinstance(msg, dict) and msg.get('role') == 'user':
                    content = msg.get('content', '')
                    char_count = len(content)
                    user_messages.append(char_count)
                    user_stats[user_id]['all_char_counts'].append(char_count)
        
        # Store conversation data
        conv_data = {
            'chat_id': conv.get('chat_id', ''),
            'created_at': conv.get('created_at'),
            'user_msg_count': len(user_messages),
        }
        
        user_stats[user_id]['conversations'].append(conv_data)
        user_stats[user_id]['all_msg_counts'].append(len(user_messages))
    
    # Calculate final statistics for each user
    output_rows = []
    
    for user_id, stats in user_stats.items():
        # Sort conversations by date to get the last one
        sorted_convs = sorted(stats['conversations'], key=lambda x: x['created_at'] if x['created_at'] else datetime.min)
        last_conv = sorted_convs[-1] if sorted_convs else None
        
        # Calculate median values
        import statistics
        mdn_msg_per_conv = statistics.median(stats['all_msg_counts']) if stats['all_msg_counts'] else 0
        mdn_char_per_msg = statistics.median(stats['all_char_counts']) if stats['all_char_counts'] else 0
        
        row = {
            'student_email': stats['student_email'],
            'user_id': stats['user_id'],
            'total_conv': len(stats['conversations']),
            'avg_msg_per_conv': round(sum(stats['all_msg_counts']) / len(stats['all_msg_counts']), 2) if stats['all_msg_counts'] else 0,
            'mdn_msg_per_conv': round(mdn_msg_per_conv, 2),
            'avg_char_per_msg': round(sum(stats['all_char_counts']) / len(stats['all_char_counts']), 2) if stats['all_char_counts'] else 0,
            'mdn_char_per_msg': round(mdn_char_per_msg, 2),
            'last_conv_date': last_conv['created_at'].strftime('%m-%d-%Y') if last_conv and last_conv['created_at'] else '',
            'last_conv_user_msg': last_conv['user_msg_count'] if last_conv else 0
        }
        
        output_rows.append(row)
    
    # Write to CSV
    week_label = f"{start_date}_to_{end_date}".replace('-', '')
    filename = f"students_usage_{week_label}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['student_email', 'user_id', 'total_conv', 'avg_msg_per_conv', 
                     'mdn_msg_per_conv', 'avg_char_per_msg', 'mdn_char_per_msg', 
                     'last_conv_date', 'last_conv_user_msg']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in output_rows:
            writer.writerow(row)
    
    print(f"Exported usage stats for {len(output_rows)} students to {filepath}")
    return filepath

async def export_all_conversations_to_csv(export_folder):
    conversations = await conversations_collection.find().sort("email", 1).to_list(None)
    
    filename = f"conversations_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(export_folder, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
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
    folder_name = f"database_exports"
    export_folder = os.path.join(current_dir, folder_name)
    
    # Create the folder
    os.makedirs(export_folder, exist_ok=True)
    print(f"Created export folder: {export_folder}")
    
    # Export all collections to the folder
    await export_conversations_to_csv(export_folder)
    await export_students_usage_to_csv(export_folder)
    #await export_users_to_csv(export_folder)
    #await export_messages_to_csv(export_folder)
    
    print(f"All exports completed in folder: {folder_name}")

# Run all exports
asyncio.run(export_all_data())