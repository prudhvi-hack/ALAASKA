from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from io import BytesIO
import markdown2
import re
from datetime import datetime

def strip_markdown(text):
    """Convert markdown to plain text"""
    if not text:
        return ""
    # Convert markdown to HTML then strip HTML tags
    html = markdown2.markdown(text)
    # Remove HTML tags
    clean = re.sub('<.*?>', '', html)
    # Decode HTML entities
    clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    clean = clean.replace('&nbsp;', ' ').replace('&quot;', '"')
    return clean.strip()

def create_gradescope_pdf(assignment_title, students_data, base_url="http://localhost:3000"):
    """
    Create a Gradescope-compatible PDF with 2 pages per question per student.
    Both pages are for student answers only (no question prompt).
    
    Args:
        assignment_title: Title of the assignment
        students_data: List of dicts with structure:
            {
                "name": "Student Name",
                "email": "student@example.com",
                "questions": [
                    {
                        "number": "1",
                        "marks": 10,
                        "student_solution": "Answer text or None",
                        "chat_id": "uuid-string",
                        "submitted_at": "2024-01-15T10:30:00" or None
                    },
                    ...
                ]
            }
        base_url: Base URL for chat links
    
    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    # Define styles
    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#34495e'),
        spaceAfter=8,
        alignment=TA_LEFT
    )
    
    link_style = ParagraphStyle(
        'LinkStyle',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#3498db'),
        spaceAfter=8,
        alignment=TA_LEFT,
        fontName='Courier'
    )
    
    answer_style = ParagraphStyle(
        'AnswerStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=10,
        leading=14,
        leftIndent=5
    )
    
    no_answer_style = ParagraphStyle(
        'NoAnswerStyle',
        parent=styles['Italic'],
        fontSize=10,
        textColor=colors.HexColor('#999999'),
        alignment=TA_LEFT,
        spaceAfter=10,
        leftIndent=5
    )
    
    answer_header_style = ParagraphStyle(
        'AnswerHeader',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#34495e'),
        fontName='Helvetica-Bold',
        spaceAfter=8
    )
    
    story = []
    
    # Iterate through each student
    for student_idx, student in enumerate(students_data):
        # Iterate through each question
        for q_idx, question in enumerate(student["questions"]):
            # ✅ Format submission time
            submitted_at_str = "Not submitted"
            if question.get('submitted_at'):
                try:
                    # Parse ISO format datetime
                    dt = datetime.fromisoformat(question['submitted_at'].replace('Z', '+00:00'))
                    submitted_at_str = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
                except:
                    submitted_at_str = str(question['submitted_at'])
            
            # Create 2 pages per question
            for page_num in range(2):
                # Student info header (on every page)
                header_data = [
                    [Paragraph(f"<b>Name:</b> {student['name']}", header_style)],
                    [Paragraph(f"<b>Email:</b> {student['email']}", header_style)],
                    [Paragraph(f"<b>Assignment:</b> {assignment_title}", header_style)],
                    [Paragraph(f"<b>Question {question['number']}</b> (Page {page_num + 1} of 2) - <b>{question['marks']} marks</b>", header_style)],
                    [Paragraph(f"<b>Submitted:</b> {submitted_at_str}", header_style)]  # ✅ Added submission time
                ]
                
                if question.get('chat_id'):
                    chat_link = f"{base_url}/?chat_id={question['chat_id']}"
                    header_data.append([Paragraph(f"<b>Chat Link:</b> {chat_link}", link_style)])
                
                header_table = Table(header_data, colWidths=[7*inch])
                header_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ]))
                
                story.append(header_table)
                story.append(Spacer(1, 0.15*inch))
                
                # Student's answer section
                if question.get('student_solution'):
                    # Clean markdown from answer
                    answer_text = strip_markdown(question['student_solution'])
                    
                    # Define limits per page (considering both chars and lines)
                    max_chars_per_page = 2000
                    max_lines_per_page = 55  # Maximum lines to prevent overflow
                    
                    def fits_on_page(text):
                        """Check if text fits within page limits"""
                        char_count = len(text)
                        line_count = text.count('\n') + 1
                        return char_count <= max_chars_per_page and line_count <= max_lines_per_page
                    
                    def truncate_to_fit(text, is_continuation=False):
                        """Truncate text to fit page limits, respecting line and char counts"""
                        lines = text.split('\n')
                        result_lines = []
                        char_count = 0
                        
                        for line in lines:
                            # Check if adding this line would exceed limits
                            line_len = len(line) + 1  # +1 for newline
                            if (len(result_lines) >= max_lines_per_page or 
                                char_count + line_len > max_chars_per_page):
                                break
                            result_lines.append(line)
                            char_count += line_len
                        
                        result = '\n'.join(result_lines)
                        
                        # Add truncation notice if we cut content
                        if len(result_lines) < len(lines):
                            if is_continuation:
                                result += "\n\n[Continued answer truncated - see chat history for full response]"
                            else:
                                result += "\n\n[Answer continues on next page...]"
                        
                        return result, len(result_lines) < len(lines)
                    
                    if page_num == 0:
                        # First page
                        story.append(Paragraph("<b>Student Answer:</b>", answer_header_style))
                        
                        if fits_on_page(answer_text):
                            # Short answer - fits on page 1
                            paragraphs = answer_text.split('\n\n')
                            for para in paragraphs:
                                if para.strip():
                                    story.append(Paragraph(para.strip(), answer_style))
                        else:
                            # Long answer - truncate to fit page 1
                            truncated_text, has_more = truncate_to_fit(answer_text, is_continuation=False)
                            paragraphs = truncated_text.split('\n\n')
                            for para in paragraphs:
                                if para.strip():
                                    story.append(Paragraph(para.strip(), answer_style))
                    
                    else:  # page_num == 1
                        # Second page
                        if not fits_on_page(answer_text):
                            # Continuation of answer
                            story.append(Paragraph("<b>Student Answer (continued):</b>", answer_header_style))
                            
                            # Calculate where page 1 ended
                            page1_text, _ = truncate_to_fit(answer_text, is_continuation=False)
                            # Remove truncation notice from page 1 text for calculation
                            if "[Answer continues on next page...]" in page1_text:
                                page1_text = page1_text.replace("\n\n[Answer continues on next page...]", "")
                            
                            # Get remainder and truncate to fit page 2
                            split_point = len(page1_text)
                            remainder = answer_text[split_point:].lstrip('\n')
                            
                            # Truncate remainder to fit page 2 (no overflow)
                            truncated_remainder, _ = truncate_to_fit(remainder, is_continuation=True)
                            
                            paragraphs = truncated_remainder.split('\n\n')
                            for para in paragraphs:
                                if para.strip():
                                    story.append(Paragraph(para.strip(), answer_style))
                        # else: page 2 stays empty if answer fits on page 1
                
                else:
                    # No answer submitted - only show on page 1
                    if page_num == 0:
                        story.append(Paragraph("<b>Student Answer:</b>", answer_header_style))
                        story.append(Paragraph("[No answer submitted]", no_answer_style))
                    # Page 2 stays empty
                
                # Page break after each page
                story.append(PageBreak())
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer