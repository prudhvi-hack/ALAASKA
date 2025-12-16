import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';

export default function StudentSubmissionDetail({ assignmentId, studentEmail, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSubmission();
  }, [assignmentId, studentEmail]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/assignments/${assignmentId}/submissions/${studentEmail}`);
      setData(response.data);
    } catch (err) {
      console.error('Error loading submission:', err);
      setError(err.response?.data?.detail || 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  // Preprocess LaTeX for rendering
  const preprocessLatex = (text) => {
    if (!text) return '';
    return text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
  };

  // Reusable Markdown component with LaTeX support
  const MarkdownContent = ({ children }) => (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeMathjax]}
      components={{
        code({ node, inline, className, children, ...props }) {
          return inline ? (
            <code className={className} {...props}>{children}</code>
          ) : (
            <pre className="code-block">
              <code className={className} {...props}>{children}</code>
            </pre>
          );
        }
      }}
    >
      {preprocessLatex(children)}
    </ReactMarkdown>
  );

  if (loading) {
    return (
      <div className="loading-spinner">
        <p>Loading submission...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
        <button onClick={onBack}>Back to Grading</button>
      </div>
    );
  }

  if (!data) return null;

  const { assignment, student, submission } = data;

  return (
    <div className="student-submission-detail">
      {/* Header */}
      <div className="submission-header">
        <button onClick={onBack} className="back-button">
          ← Back to Grading
        </button>
        <div className="submission-title-section">
          <h2>{student.name}'s Submission</h2>
          <p className="student-email">{student.email}</p>
        </div>
        <div className="submission-meta">
          <h3>{assignment.title}</h3>
          {submission.submitted ? (
            <p className="submission-status submitted">
              ✓ Submitted on {new Date(submission.submitted_at).toLocaleString()}
            </p>
          ) : submission.accepted ? (
            <p className="submission-status in-progress">
              In Progress • {submission.questions_answered}/{submission.total_questions} answered
            </p>
          ) : (
            <p className="submission-status" style={{ background: '#f8d7da', color: '#721c24' }}>
              Not Accepted • Student has not started this assignment
            </p>
          )}
        </div>
      </div>

      {/* Instructions */}
      {assignment.instructions_md && (
        <div className="assignment-instructions">
          <h3>Assignment Instructions</h3>
          <div className="markdown-content">
            <MarkdownContent>{assignment.instructions_md}</MarkdownContent>
          </div>
        </div>
      )}

      {/* Questions and Answers */}
      <div className="questions-list">
        {submission.questions.map((question, idx) => (
          <div 
            key={question.question_id} 
            className={`question-card ${question.student_solution ? 'answered' : 'unanswered'}`}
          >
            {/* Question Header */}
            <div className="question-header">
              <h3>Question {question.number || idx + 1}</h3>
              <div className="question-meta">
                <span className="marks-badge">{question.marks} marks</span>
                {question.student_solution ? (
                  <span className="answer-status answered">✓ Answered</span>
                ) : (
                  <span className="answer-status unanswered">Not Answered</span>
                )}
              </div>
            </div>

            {/* Question Prompt */}
            <div className="question-prompt">
              <div className="markdown-content">
                <MarkdownContent>{question.prompt_md}</MarkdownContent>
              </div>
            </div>

            {/* Student Answer */}
            {question.student_solution ? (
              <div className="student-answer-section">
                <div className="answer-header">
                  <h4>Student's Answer</h4>
                  {question.submitted_at && (
                    <span className="submission-time">
                      Submitted: {new Date(question.submitted_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="student-answer">
                  <div className="markdown-content">
                    <MarkdownContent>{question.student_solution}</MarkdownContent>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-answer">
                <p>Student has not submitted an answer for this question.</p>
              </div>
            )}

            {/* Chat Link - Show regardless of answer submission */}
            {question.chat_id && (
              <div className="chat-link-section">
                <a 
                  href={`/?chat_id=${question.chat_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-chat-button"
                >
                  💬 View Chat History
                </a>
              </div>
            )}

            {/* Chat History Preview - Show regardless of answer submission */}
            {question.chat_history && question.chat_history.length > 0 && (
              <details className="chat-history-preview">
                <summary>Chat History ({question.chat_history.length} messages)</summary>
                <div className="chat-messages">
                  {question.chat_history.map((msg, msgIdx) => (
                    <div key={msgIdx} className={`chat-message ${msg.role}`}>
                      <div className="message-header">
                        <span className="message-role">
                          {msg.role === 'user' ? '👤 Student' : '🤖 ALAASKA'}
                        </span>
                      </div>
                      <div className="message-content">
                        <MarkdownContent>{msg.content}</MarkdownContent>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Hints (if any) */}
            {question.hints && question.hints.length > 0 && (
              <details className="hints-section">
                <summary>Available Hints ({question.hints.length})</summary>
                <ul className="hints-list">
                  {question.hints.map((hint, hintIdx) => (
                    <li key={hintIdx}>{hint}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
