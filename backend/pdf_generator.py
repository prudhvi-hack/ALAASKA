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

def escape_for_paragraph(text):
    """Escape text for use in ReportLab Paragraph to prevent XML parsing errors"""
    if not text:
        return ""
    # Escape special XML/HTML characters
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

def _to_paragraph_markup(text):
    """Convert plain text into safe Paragraph markup preserving line breaks."""
    if not text:
        return ""
    return escape_for_paragraph(text).replace('\n', '<br/>')

def _paragraph_height(text, style, width):
    """Measure rendered height for text in a ReportLab Paragraph."""
    if not text or not text.strip():
        return 0
    paragraph = Paragraph(_to_paragraph_markup(text), style)
    _, height = paragraph.wrap(width, 10_000)
    # Paragraph flow also consumes style spacing in frame layout.
    return height + getattr(style, 'spaceBefore', 0) + getattr(style, 'spaceAfter', 0)

def _fit_lines_to_height(lines, max_height, style, width, overflow_notice=None):
    """
    Return how many leading lines fit in max_height.

    If overflow_notice is provided, it is appended while measuring whenever content
    is truncated to ensure the notice itself also fits.
    """
    if max_height <= 0 or not lines:
        return 0

    lo, hi = 0, len(lines)
    best = 0

    while lo <= hi:
        mid = (lo + hi) // 2
        candidate = '\n'.join(lines[:mid])
        if mid < len(lines) and overflow_notice:
            candidate = (candidate + '\n\n' + overflow_notice).strip()

        if _paragraph_height(candidate, style, width) <= max_height:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1

    return best

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

    continuation_notice = "[Answer continues on next page...]"
    truncated_notice = "[Continued answer truncated - see chat history for full response]"
    spacer_height = 0.15 * inch
    # Small guard band to avoid borderline wrap differences causing overflow pages.
    layout_safety_margin = 6
    
    # Iterate through each student
    for student_idx, student in enumerate(students_data):
        # Iterate through each question
        for q_idx, question in enumerate(student["questions"]):
            # Format submission time
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
                    [Paragraph(f"<b>Name:</b> {escape_for_paragraph(student['name'])}", header_style)],
                    [Paragraph(f"<b>Email:</b> {escape_for_paragraph(student['email'])}", header_style)],
                    [Paragraph(f"<b>Assignment:</b> {escape_for_paragraph(assignment_title)}", header_style)],
                    [Paragraph(f"<b>Question {escape_for_paragraph(str(question['number']))}</b> (Page {page_num + 1} of 2) - <b>{question['marks']} marks</b>", header_style)],
                    [Paragraph(f"<b>Submitted:</b> {escape_for_paragraph(submitted_at_str)}", header_style)]
                ]
                
                if question.get('chat_id'):
                    chat_link = f"{base_url}/?chat_id={question['chat_id']}"
                    header_data.append([Paragraph(f"<b>Chat Link:</b> {escape_for_paragraph(chat_link)}", link_style)])
                
                header_table = Table(header_data, colWidths=[7*inch])
                header_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ]))

                # Measure fixed space consumed before answer content.
                _, header_height = header_table.wrap(doc.width, doc.height)
                
                story.append(header_table)
                story.append(Spacer(1, spacer_height))
                
                # Student's answer section
                if question.get('student_solution'):
                    # Clean markdown from answer
                    answer_text = strip_markdown(question['student_solution'])
                    answer_lines = answer_text.split('\n')
                    
                    if page_num == 0:
                        # First page
                        story.append(Paragraph("<b>Student Answer:</b>", answer_header_style))

                        answer_header_height = _paragraph_height("Student Answer:", answer_header_style, doc.width)
                        max_answer_height = max(0, doc.height - header_height - spacer_height - answer_header_height - layout_safety_margin)

                        # Fit as many lines as possible on page 1, reserving space for continuation notice if needed.
                        page1_line_count = _fit_lines_to_height(
                            answer_lines,
                            max_answer_height,
                            answer_style,
                            doc.width,
                            overflow_notice=continuation_notice
                        )

                        if page1_line_count >= len(answer_lines):
                            page1_text = answer_text
                        else:
                            page1_text = '\n'.join(answer_lines[:page1_line_count]).strip()
                            if page1_text:
                                page1_text += '\n\n' + continuation_notice
                            else:
                                page1_text = continuation_notice

                        story.append(Paragraph(_to_paragraph_markup(page1_text), answer_style))
                    
                    else:  # page_num == 1
                        # Recompute what page 1 consumed so page 2 only gets true remainder.
                        answer_header_height_p1 = _paragraph_height("Student Answer:", answer_header_style, doc.width)
                        max_answer_height_p1 = max(0, doc.height - header_height - spacer_height - answer_header_height_p1 - layout_safety_margin)
                        page1_line_count = _fit_lines_to_height(
                            answer_lines,
                            max_answer_height_p1,
                            answer_style,
                            doc.width,
                            overflow_notice=continuation_notice
                        )

                        if page1_line_count < len(answer_lines):
                            story.append(Paragraph("<b>Student Answer (continued):</b>", answer_header_style))

                            answer_header_height = _paragraph_height("Student Answer (continued):", answer_header_style, doc.width)
                            max_answer_height = max(0, doc.height - header_height - spacer_height - answer_header_height - layout_safety_margin)

                            remaining_lines = answer_lines[page1_line_count:]
                            page2_line_count = _fit_lines_to_height(
                                remaining_lines,
                                max_answer_height,
                                answer_style,
                                doc.width,
                                overflow_notice=truncated_notice
                            )

                            if page2_line_count >= len(remaining_lines):
                                page2_text = '\n'.join(remaining_lines)
                            else:
                                page2_text = '\n'.join(remaining_lines[:page2_line_count]).strip()
                                if page2_text:
                                    page2_text += '\n\n' + truncated_notice
                                else:
                                    page2_text = truncated_notice

                            story.append(Paragraph(_to_paragraph_markup(page2_text), answer_style))
                        # else: page 2 stays empty if answer fits on page 1
                
                else:
                    # No answer submitted - only show on page 1
                    if page_num == 0:
                        story.append(Paragraph("<b>Student Answer:</b>", answer_header_style))
                        story.append(Paragraph("[No answer submitted]", no_answer_style))
                    # Page 2 stays empty
                
                # Page break after each page except the final generated page.
                is_last_student = student_idx == len(students_data) - 1
                is_last_question = q_idx == len(student["questions"]) - 1
                is_last_page = page_num == 1
                if not (is_last_student and is_last_question and is_last_page):
                    story.append(PageBreak())
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer