import os
import asyncio
import csv
import ast
import json
import re
import statistics
from datetime import datetime, timedelta
from db_mongo import initialize_database, conversations_collection, users_collection, messages_collection

async def export_conversations_to_csv(conv_export_folder):
    PERIOD_START, PERIOD_END = "2026-01-13", "2026-06-23"
    users_csv_path = "./students.csv"

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    weeks, week_start = [], datetime.strptime(PERIOD_START, '%Y-%m-%d')
    while week_start <= datetime.strptime(PERIOD_END, '%Y-%m-%d'):
        week_end = week_start + timedelta(days=6)
        if week_end >= today:
            break
        weeks.append((week_start, week_end))
        week_start += timedelta(days=7)

    users_id_csv, user_to_email_map = [], {}
    with open(users_csv_path, 'r', encoding='latin-1') as f:
        for row in csv.DictReader(f):
            uid, grp, email = row.get('user_id', '').strip(), row.get('group', '').strip(), row.get('student_email', '').strip()
            if uid and grp == 'Group B':
                users_id_csv.append(uid)
                user_to_email_map[uid] = email
    print(f"DEBUG: Loaded {len(users_id_csv)} user IDs from CSV")
    print(f"DEBUG: First 3 user IDs: {users_id_csv[:3]}")

    all_filepaths = []

    for week_start, week_end in weeks:
        start_date, end_date = week_start.strftime('%Y-%m-%d'), week_end.strftime('%Y-%m-%d')
        query_filter = {'created_at': {'$gte': week_start, '$lte': week_end.replace(hour=23, minute=59, second=59)}}
        if users_id_csv:
            query_filter['user_id'] = {'$in': users_id_csv}

        conversations = await conversations_collection.find(query_filter).sort("email", 1).to_list(None)

        filename = f"db_conversations_{start_date.replace('-', '')}_to_{end_date.replace('-', '')}.csv"
        filepath = os.path.join(conv_export_folder, filename)
        # UNCOMMENT THIS BELOW TO GENERATE ONLY NEW WEEKS AND SKIP EXISTING FILES
        #if os.path.exists(filepath):
            #print(f"Skipping {filename}, already exists")
            #continue

        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['chat_id', 'user_id', 'student_email', 'summary', 'status', 'created_at', 'updated_at', 'messages',
                          'is_deleted', 'is_assignment_chat', 'assignment_id', 'question_id', 'rag_homework_answers', 'rag_done']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

            for conv in conversations:
                try:
                    for msg in conv.get('messages', []):
                        if isinstance(msg, dict) and msg.get('role') == 'system' and msg.get('content'):
                            msg['content'] = msg['content'][:15] + "..."
                except Exception as e:
                    print(f"Error processing messages: {e}")

                conv['student_email'] = user_to_email_map.get(conv.get('user_id', ''), '')
                conv['created_at'] = conv['created_at'].isoformat() if conv.get('created_at') else ''
                conv['updated_at'] = conv['updated_at'].isoformat() if conv.get('updated_at') else ''
                writer.writerow({field: conv.get(field, '') for field in fieldnames})

        print(f"Exported {len(conversations)} conversations to {filepath}")
        all_filepaths.append(filepath)

    return all_filepaths

async def export_students_usage_to_csv(export_folder):
    """Export student usage statistics aggregated by student for a weekly period."""
    PERIOD_START, PERIOD_END = "2026-01-13", "2026-06-23"
    users_csv_path = "./students.csv"

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    weeks, week_start = [], datetime.strptime(PERIOD_START, '%Y-%m-%d')
    while week_start <= datetime.strptime(PERIOD_END, '%Y-%m-%d'):
        week_end = week_start + timedelta(days=6)
        if week_end >= today:
            break
        weeks.append((week_start, week_end))
        week_start += timedelta(days=7)

    users_id_csv, user_to_email_map = [], {}
    if users_csv_path:
        with open(users_csv_path, 'r', encoding='latin-1') as f:
            for row in csv.DictReader(f):
                uid, grp, email = row.get('user_id', '').strip(), row.get('group', '').strip(), row.get('student_email', '').strip()
                if uid and grp == 'Group B':
                    users_id_csv.append(uid)
                    user_to_email_map[uid] = email

    all_filepaths = []

    for week_start, week_end in weeks:
        start_date, end_date = week_start.strftime('%Y-%m-%d'), week_end.strftime('%Y-%m-%d')
        query_filter = {'created_at': {'$gte': week_start, '$lte': week_end.replace(hour=23, minute=59, second=59)}}
        if users_id_csv:
            query_filter['user_id'] = {'$in': users_id_csv}

        conversations = await conversations_collection.find(query_filter).sort("user_id", 1).to_list(None)
        print(f"DEBUG: Found {len(conversations)} conversations for usage analysis")

        user_stats = {}
        for conv in conversations:
            uid = conv.get('user_id', '')
            if not uid:
                continue
            if uid not in user_stats:
                user_stats[uid] = {'student_email': user_to_email_map.get(uid, ''), 'user_id': uid, 'conversations': [], 'all_msg_counts': [], 'all_char_counts': []}
            char_counts = [len(msg.get('content', '')) for msg in conv.get('messages', []) if isinstance(msg, dict) and msg.get('role') == 'user']
            user_stats[uid]['all_char_counts'].extend(char_counts)
            user_stats[uid]['conversations'].append({'chat_id': conv.get('chat_id', ''), 'created_at': conv.get('created_at'), 'user_msg_count': len(char_counts)})
            user_stats[uid]['all_msg_counts'].append(len(char_counts))

        output_rows = []
        for uid, stats in user_stats.items():
            last_conv = max(stats['conversations'], key=lambda x: x['created_at'] or datetime.min, default=None)
            msgs, chars = stats['all_msg_counts'], stats['all_char_counts']
            output_rows.append({
                'student_email': stats['student_email'], 'user_id': uid,
                'total_conv': len(stats['conversations']),
                'avg_msg_per_conv': round(sum(msgs) / len(msgs), 2) if msgs else 0,
                'mdn_msg_per_conv': round(statistics.median(msgs), 2) if msgs else 0,
                'avg_char_per_msg': round(sum(chars) / len(chars), 2) if chars else 0,
                'mdn_char_per_msg': round(statistics.median(chars), 2) if chars else 0,
                'last_conv_date': last_conv['created_at'].strftime('%m-%d-%Y') if last_conv and last_conv['created_at'] else '',
                'last_conv_user_msg': last_conv['user_msg_count'] if last_conv else 0
            })

        filename = f"db_usage_{start_date.replace('-', '')}_to_{end_date.replace('-', '')}.csv"
        filepath = os.path.join(export_folder, filename)
        # UNCOMMENT THIS BELOW TO GENERATE ONLY NEW WEEKS AND SKIP EXISTING FILES
        #if os.path.exists(filepath):
            #print(f"Skipping {filename}, already exists")
            #continue

        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['student_email', 'user_id', 'total_conv', 'avg_msg_per_conv', 'mdn_msg_per_conv', 'avg_char_per_msg', 'mdn_char_per_msg', 'last_conv_date', 'last_conv_user_msg']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(output_rows)

        print(f"Exported usage stats for {len(output_rows)} students to {filepath}")
        all_filepaths.append(filepath)

    return all_filepaths

async def export_all_conversations_to_csv(export_folder):
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
    folder_name = f"db_exports"
    export_folder = os.path.join(current_dir, folder_name)
    conv_folder_name = f"db_conversations"
    conv_export_folder = os.path.join(current_dir, conv_folder_name)
    
    # Create the folder
    os.makedirs(export_folder, exist_ok=True)
    print(f"Created export folder: {export_folder}")

    os.makedirs(conv_export_folder, exist_ok=True)
    print(f"Created export folder: {conv_export_folder}")
    
    # Export all collections to the folder
    await export_conversations_to_csv(conv_export_folder)
    await export_students_usage_to_csv(export_folder)
    #await export_users_to_csv(export_folder)
    #await export_messages_to_csv(export_folder)
    
    print(f"All exports completed in folder: {folder_name}")

# Run all exports
asyncio.run(export_all_data())