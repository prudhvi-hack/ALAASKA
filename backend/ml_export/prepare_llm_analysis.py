#!/usr/bin/env python3
"""
LLM Conversation Preparation Script for Perplexity Analysis

This script prepares clean conversation data for LLM-based integrity analysis.
It removes metadata and formats conversations for easy LLM evaluation.

Usage:
    python prepare_llm_analysis.py --input ./ --output ./llm_analysis

Input files expected:
    - assignments.json
    - conversations.json
    - student_assignments.json

Output files:
    - conversations_for_llm.json  : All conversations formatted for LLM
    - individual/                  : Individual conversation files
    - batch_prompts.json          : Ready-to-use prompts for LLM API
"""

import argparse
import json
import os
from typing import Dict, List, Any
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# LLM ANALYSIS PROMPT TEMPLATE
# ═══════════════════════════════════════════════════════════════════════════════

ANALYSIS_PROMPT = """You are an academic integrity analyst. Analyze the following student-AI tutoring conversation for signs of academic dishonesty.

## Context
- This is a conversation between a student and an AI tutor for an assignment question
- Students should be learning by asking questions, showing confusion, making mistakes, and iterating
- Suspicious behavior includes: copy-pasting complete answers, submitting LLM-generated text as their own work

## Question
{question_text}

## Student-AI Conversation
{conversation}

## Analysis Required
Rate each dimension from 1-10 and provide brief justification:

1. **Engagement Authenticity** (1=robotic/fake, 10=genuine learning)
   - Does the student ask clarifying questions?
   - Do they show confusion or make mistakes?
   - Is there natural back-and-forth dialogue?

2. **Writing Style Consistency** (1=inconsistent/suspicious, 10=consistent throughout)
   - Does writing style change dramatically between messages?
   - Are some messages much more polished than others?

3. **LLM Artifact Detection** (1=many artifacts, 10=no artifacts)
   - Overly formal language ("Furthermore", "Moreover", "In conclusion")
   - Excessive bullet points or numbered lists
   - Hedging phrases ("It's worth noting", "One could argue")
   - Perfect grammar in contrast to casual messages

4. **Learning Progression** (1=no progression, 10=clear learning)
   - Does understanding improve over the conversation?
   - Are there "aha" moments or corrections?

5. **Response Plausibility** (1=implausible, 10=plausible)
   - Are responses appropriate for the time likely spent?
   - Do long, complex responses appear too quickly?

## Output Format
Provide your analysis as JSON:
```json
{{
    "engagement_authenticity": {{"score": X, "justification": "..."}},
    "writing_style_consistency": {{"score": X, "justification": "..."}},
    "llm_artifact_detection": {{"score": X, "justification": "..."}},
    "learning_progression": {{"score": X, "justification": "..."}},
    "response_plausibility": {{"score": X, "justification": "..."}},
    "overall_integrity_score": X,
    "risk_level": "low|medium|high",
    "key_concerns": ["concern1", "concern2"],
    "summary": "One paragraph summary of findings"
}}
```"""


BATCH_ANALYSIS_PROMPT = """Analyze the following student conversation for academic integrity. 
Rate from 1-10: engagement authenticity, writing consistency, LLM artifacts (10=none), learning progression, response plausibility.
Provide overall_integrity_score (1-10), risk_level (low/medium/high), and brief summary.

Question: {question_text}

Conversation:
{conversation}

Respond with JSON only."""


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════════════════

def load_json(filepath: str) -> Any:
    """Load JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_data(input_dir: str) -> Dict[str, Any]:
    """Load required JSON files."""
    print(f"\n{'='*60}")
    print("LOADING DATA")
    print(f"{'='*60}")
    
    data = {}
    
    files = [
        ('assignments', 'assignments.json'),
        ('conversations', 'conversations.json'),
        ('student_assignments', 'student_assignments.json'),
    ]
    
    for key, filename in files:
        filepath = os.path.join(input_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Missing required file: {filepath}")
        
        data[key] = load_json(filepath)
        print(f"  ✓ {filename}: {len(data[key])} records")
    
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# CONVERSATION FORMATTING
# ═══════════════════════════════════════════════════════════════════════════════

def format_message(msg: Dict, include_timestamps: bool = False) -> str:
    """Format a single message for LLM analysis."""
    role = msg.get('role', 'unknown')
    content = msg.get('content', '')
    
    # Clean up the content
    content = content.strip()
    
    # Role labels
    if role == 'user':
        label = "STUDENT"
    elif role == 'assistant':
        label = "AI TUTOR"
    elif role == 'system':
        return ""  # Skip system messages
    else:
        label = role.upper()
    
    if include_timestamps and msg.get('timestamp'):
        ts = msg.get('timestamp', '')[:19]  # Truncate to seconds
        return f"[{ts}] {label}:\n{content}"
    else:
        return f"{label}:\n{content}"


def format_conversation(messages: List[Dict], include_timestamps: bool = False) -> str:
    """Format entire conversation for LLM analysis."""
    formatted_msgs = []
    
    for msg in messages:
        formatted = format_message(msg, include_timestamps)
        if formatted:  # Skip empty (system messages)
            formatted_msgs.append(formatted)
    
    return "\n\n---\n\n".join(formatted_msgs)


def extract_student_messages_only(messages: List[Dict]) -> str:
    """Extract only student messages for focused analysis."""
    student_msgs = []
    
    for i, msg in enumerate(messages):
        if msg.get('role') == 'user':
            content = msg.get('content', '').strip()
            student_msgs.append(f"[Message {len(student_msgs)+1}]\n{content}")
    
    return "\n\n".join(student_msgs)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PROCESSING
# ═══════════════════════════════════════════════════════════════════════════════

def prepare_conversations_for_llm(data: Dict[str, Any]) -> List[Dict]:
    """Prepare all conversations for LLM analysis."""
    
    print(f"\n{'='*60}")
    print("PREPARING CONVERSATIONS")
    print(f"{'='*60}")
    
    # Index data
    conversations_by_chat = {c['chat_id']: c for c in data['conversations']}
    
    # Build question lookup
    questions_by_id = {}
    for assignment in data['assignments']:
        for q in assignment.get('questions', []):
            questions_by_id[q['question_id']] = {
                'question_text': q.get('prompt_md', ''),
                'question_number': q.get('number', ''),
                'marks': q.get('marks', 0),
                'assignment_title': assignment.get('title', ''),
            }
    
    prepared = []
    
    for student_assignment in data['student_assignments']:
        student_email = student_assignment.get('student_email', '')
        assignment_id = student_assignment.get('assignment_id', '')
        
        for question in student_assignment.get('questions', []):
            chat_id = question.get('chat_id')
            if not chat_id:
                continue
            
            question_id = question.get('question_id', '')
            question_num = question.get('number', '')
            
            # Get conversation
            conversation = conversations_by_chat.get(chat_id, {})
            messages = conversation.get('messages', [])
            
            if not messages:
                continue
            
            # Get question info
            q_info = questions_by_id.get(question_id, {})
            question_text = q_info.get('question_text') or ''
            
            print(f"  Processing: {student_email} - Q{question_num}")
            
            # Count messages by role
            student_msg_count = sum(1 for m in messages if m.get('role') == 'user')
            ai_msg_count = sum(1 for m in messages if m.get('role') == 'assistant')
            
            # Prepare the entry
            entry = {
                # Identifiers
                'chat_id': chat_id,
                'student_email': student_email,
                'assignment_id': assignment_id,
                'question_id': question_id,
                'question_number': question_num,
                
                # Question context
                'question_text': question_text,
                'assignment_title': q_info.get('assignment_title', ''),
                
                # Conversation stats
                'total_messages': len(messages),
                'student_messages': student_msg_count,
                'ai_messages': ai_msg_count,
                
                # Formatted conversations (different formats for different uses)
                'conversation_full': format_conversation(messages, include_timestamps=False),
                'conversation_with_timestamps': format_conversation(messages, include_timestamps=True),
                'student_messages_only': extract_student_messages_only(messages),
                
                # Submission info
                'submitted_solution': question.get('student_solution') or '',
                'submitted_at': question.get('submitted_at') or '',
                'is_correct': question.get('is_correct'),
                
                # Ready-to-use prompts
                'analysis_prompt': ANALYSIS_PROMPT.format(
                    question_text=question_text[:1000],
                    conversation=format_conversation(messages)[:8000]  # Limit for token count
                ),
                'batch_prompt': BATCH_ANALYSIS_PROMPT.format(
                    question_text=question_text[:500],
                    conversation=format_conversation(messages)[:4000]
                ),
            }
            
            prepared.append(entry)
    
    print(f"\n  ✓ Prepared {len(prepared)} conversations")
    return prepared


def save_outputs(prepared: List[Dict], output_dir: str):
    """Save prepared data in various formats."""
    
    print(f"\n{'='*60}")
    print("SAVING OUTPUT")
    print(f"{'='*60}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Save all conversations in one file
    all_file = os.path.join(output_dir, 'conversations_for_llm.json')
    with open(all_file, 'w', encoding='utf-8') as f:
        json.dump(prepared, f, indent=2, ensure_ascii=False)
    print(f"  ✓ conversations_for_llm.json ({len(prepared)} conversations)")
    
    # 2. Save individual conversation files
    individual_dir = os.path.join(output_dir, 'individual')
    os.makedirs(individual_dir, exist_ok=True)
    
    for entry in prepared:
        filename = f"{entry['student_email']}_Q{entry['question_number']}.txt"
        filepath = os.path.join(individual_dir, filename)
        
        content = f"""STUDENT: {entry['student_email']}
QUESTION: Q{entry['question_number']}
ASSIGNMENT: {entry['assignment_title']}

{'='*60}
QUESTION TEXT
{'='*60}
{entry['question_text']}

{'='*60}
CONVERSATION ({entry['student_messages']} student messages, {entry['ai_messages']} AI messages)
{'='*60}
{entry['conversation_full']}

{'='*60}
SUBMITTED SOLUTION
{'='*60}
{entry['submitted_solution'] or '(Not submitted)'}
"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    print(f"  ✓ individual/ ({len(prepared)} text files)")
    
    # 3. Save batch prompts for API use
    batch_prompts = []
    for entry in prepared:
        batch_prompts.append({
            'chat_id': entry['chat_id'],
            'student_email': entry['student_email'],
            'question_number': entry['question_number'],
            'prompt': entry['batch_prompt'],
        })
    
    batch_file = os.path.join(output_dir, 'batch_prompts.json')
    with open(batch_file, 'w', encoding='utf-8') as f:
        json.dump(batch_prompts, f, indent=2, ensure_ascii=False)
    print(f"  ✓ batch_prompts.json (ready for API calls)")
    
    # 4. Save student-messages-only version (for pure text analysis)
    student_only = []
    for entry in prepared:
        student_only.append({
            'chat_id': entry['chat_id'],
            'student_email': entry['student_email'],
            'question_number': entry['question_number'],
            'text': entry['student_messages_only'],
        })
    
    student_file = os.path.join(output_dir, 'student_messages_only.json')
    with open(student_file, 'w', encoding='utf-8') as f:
        json.dump(student_only, f, indent=2, ensure_ascii=False)
    print(f"  ✓ student_messages_only.json (for perplexity analysis)")
    
    print(f"\n  All files saved to: {os.path.abspath(output_dir)}")


def print_sample(prepared: List[Dict]):
    """Print a sample conversation for verification."""
    
    if not prepared:
        return
    
    print(f"\n{'='*60}")
    print("SAMPLE OUTPUT")
    print(f"{'='*60}")
    
    sample = prepared[0]
    print(f"\nStudent: {sample['student_email']}")
    print(f"Question: Q{sample['question_number']}")
    print(f"Messages: {sample['student_messages']} student, {sample['ai_messages']} AI")
    
    print(f"\n--- Question ---")
    print(sample['question_text'][:300] + "..." if len(sample['question_text']) > 300 else sample['question_text'])
    
    print(f"\n--- Conversation Preview ---")
    conv_preview = sample['conversation_full'][:1000]
    print(conv_preview + "..." if len(sample['conversation_full']) > 1000 else conv_preview)


# ═══════════════════════════════════════════════════════════════════════════════
# LLM API HELPER (Optional - for automated analysis)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_with_openai(prompt: str, api_key: str) -> Dict:
    """
    Send prompt to OpenAI API for analysis.
    
    Usage:
        result = analyze_with_openai(entry['analysis_prompt'], 'sk-...')
    """
    try:
        import openai
        
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an academic integrity analyst. Respond with JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    except ImportError:
        print("OpenAI library not installed. Run: pip install openai")
        return {}
    except Exception as e:
        print(f"API Error: {e}")
        return {}


def run_batch_analysis(prepared: List[Dict], api_key: str, output_file: str):
    """
    Run batch analysis on all conversations using OpenAI API.
    
    Usage:
        python prepare_llm_analysis.py --input ./ --output ./llm_analysis --analyze --api-key sk-...
    """
    print(f"\n{'='*60}")
    print("RUNNING LLM ANALYSIS")
    print(f"{'='*60}")
    
    results = []
    
    for i, entry in enumerate(prepared):
        print(f"  [{i+1}/{len(prepared)}] Analyzing {entry['student_email']} Q{entry['question_number']}...")
        
        analysis = analyze_with_openai(entry['batch_prompt'], api_key)
        
        results.append({
            'chat_id': entry['chat_id'],
            'student_email': entry['student_email'],
            'question_number': entry['question_number'],
            'analysis': analysis,
        })
    
    # Save results
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n  ✓ Analysis results saved to: {output_file}")
    
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Prepare conversations for LLM perplexity analysis"
    )
    parser.add_argument(
        '--input', '-i',
        type=str,
        default='.',
        help='Input directory containing exported JSON files'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='./llm_analysis',
        help='Output directory for prepared files'
    )
    parser.add_argument(
        '--analyze',
        action='store_true',
        help='Run automated LLM analysis (requires --api-key)'
    )
    parser.add_argument(
        '--api-key',
        type=str,
        help='OpenAI API key for automated analysis'
    )
    
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("LLM CONVERSATION PREPARATION")
    print("="*60)
    print(f"Input directory:  {os.path.abspath(args.input)}")
    print(f"Output directory: {os.path.abspath(args.output)}")
    
    # Load data
    data = load_data(args.input)
    
    # Prepare conversations
    prepared = prepare_conversations_for_llm(data)
    
    # Save outputs
    save_outputs(prepared, args.output)
    
    # Show sample
    print_sample(prepared)
    
    # Run automated analysis if requested
    if args.analyze:
        if not args.api_key:
            print("\n⚠ --analyze requires --api-key")
        else:
            results_file = os.path.join(args.output, 'llm_analysis_results.json')
            run_batch_analysis(prepared, args.api_key, results_file)
    
    print(f"\n{'='*60}")
    print("NEXT STEPS")
    print(f"{'='*60}")
    print("""
1. MANUAL REVIEW:
   - Open individual/*.txt files to review conversations
   - Use conversations_for_llm.json for programmatic access

2. LLM ANALYSIS OPTIONS:
   
   a) ChatGPT/Claude Web UI:
      - Copy content from individual/*.txt
      - Paste into ChatGPT/Claude with the analysis prompt
   
   b) API Batch Processing:
      - Use batch_prompts.json with OpenAI/Anthropic API
      - Run: python prepare_llm_analysis.py --analyze --api-key YOUR_KEY
   
   c) Perplexity Score (external tool):
      - Use student_messages_only.json
      - Feed to GPT-2 perplexity calculator

3. MERGE RESULTS:
   - After LLM analysis, merge scores back into features.csv
   - Add columns: llm_integrity_score, llm_risk_level
""")
    
    print("✓ Preparation complete!")


if __name__ == "__main__":
    main()
