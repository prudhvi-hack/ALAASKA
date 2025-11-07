import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';
import '../styles/assignments.css';

export default function AssignmentsPage({ 
  autoOpenAssignmentId = null, 
  autoScrollToQuestionId = null,
  onClearAutoOpen = null  // ✅ NEW: Callback to clear auto-open states
}) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  // ✅ Auto-open assignment when navigating from chat
  useEffect(() => {
    if (autoOpenAssignmentId && assignments.length > 0 && !selectedAssignment) {
      const assignment = assignments.find(a => a.assignment_id === autoOpenAssignmentId);
      if (assignment) {
        loadAssignmentDetails(autoOpenAssignmentId);
      }
    }
  }, [autoOpenAssignmentId, assignments, selectedAssignment]);

  // ✅ Auto-scroll to question after assignment loads
  useEffect(() => {
    if (selectedAssignment && autoScrollToQuestionId) {
      setTimeout(() => {
        const questionCard = document.querySelector(`[data-question-id="${autoScrollToQuestionId}"]`);
        if (questionCard) {
          questionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          questionCard.classList.add('highlight-question');
          setTimeout(() => questionCard.classList.remove('highlight-question'), 2000);
        }
      }, 300);
    }
  }, [selectedAssignment, autoScrollToQuestionId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/assignments');
      setAssignments(res.data.assignments || res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      
      if (err.message === 'Session expired') {
        return;
      }
      
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const acceptAssignment = async (assignmentId) => {
    try {
      await api.post(`/assignments/${assignmentId}/accept`);
      alert('Assignment accepted!');
      loadAssignments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept assignment');
    }
  };

  const loadAssignmentDetails = async (assignmentId) => {
    try {
      setLoadingDetails(true);
      const res = await api.get(`/assignments/${assignmentId}`);
      setSelectedAssignment(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load assignment details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // ✅ UPDATED: Clear auto-open states when going back
  const handleBackToAssignments = () => {
    setSelectedAssignment(null);
    
    // Clear auto-open states in parent component
    if (onClearAutoOpen) {
      onClearAutoOpen();
    }
  };

  const openQuestionChat = async (questionId, questionNumber, reset = false) => {
    try {
      if (reset) {
        const confirmed = window.confirm(
          `Start a new chat for Question ${questionNumber}? Your current conversation will be saved in history.`
        );
        if (!confirmed) return;
      }
      
      const res = await api.get(
        `/assignments/${selectedAssignment.assignment_id}/questions/${questionId}/chat`,
        { params: { reset } }
      );
      
      if (reset) {
        alert('New chat started! Your previous conversation is saved.');
      }
      
      window.location.href = `/?chat_id=${res.data.chat_id}`;
    } catch (err) {
      console.error('[AssignmentsPage] Failed to open question chat:', err);
      alert(err.response?.data?.detail || 'Failed to open question chat');
    }
  };

  if (loading) {
    return (
      <div className="assignments-loading">
        <p>Loading assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assignments-error">
        <p>{error}</p>
        <button onClick={loadAssignments} className="retry-button">Retry</button>
      </div>
    );
  }

  if (selectedAssignment) {
    return (
      <div className="assignment-detail-container">
        {/* ✅ UPDATED: Use the new handler */}
        <button onClick={handleBackToAssignments} className="back-button">
          ← Back to Assignments
        </button>

        <div className="assignment-detail-header">
          <h2>{selectedAssignment.title}</h2>
          <p className="assignment-description">{selectedAssignment.description}</p>
        </div>

        <div className="assignment-questions-section">
          <h3>Questions</h3>

          {loadingDetails ? (
            <p className="loading-text">Loading questions...</p>
          ) : selectedAssignment.questions && selectedAssignment.questions.length > 0 ? (
            <div className="questions-grid">
              {selectedAssignment.questions.map((q, idx) => (
                <div 
                  key={q.question_id || idx} 
                  className="question-card"
                  data-question-id={q.question_id}
                >
                  <div className="question-card-header">
                    <h4>Question {q.number || (idx + 1)}</h4>
                    {q.marks && (
                      <span className="marks-badge">
                        {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                      </span>
                    )}
                  </div>
                  
                  <div className="question-text">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({node, inline, className, children, ...props}) {
                          return inline ? (
                            <code className="inline-code" {...props}>
                              {children}
                            </code>
                          ) : (
                            <pre className="code-block">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          );
                        }
                      }}
                    >
                      {q.prompt_md || q.question_text || 'No question text available'}
                    </ReactMarkdown>
                  </div>
                  
                  {q.hints && q.hints.length > 0 && q.hints.some(hint => hint && hint.trim()) && (
                    <details className="hints-section">
                      <summary className="hints-summary">
                        💡 Show Hints ({q.hints.filter(h => h && h.trim()).length})
                      </summary>
                      <ul className="hints-list">
                        {q.hints
                          .filter(hint => hint && hint.trim())
                          .map((hint, hIdx) => (
                            <li key={hIdx}>{hint}</li>
                          ))
                        }
                      </ul>
                    </details>
                  )}

                  {q.student_solution && (
                    <div className="student-solution-box">
                      <div className="solution-header">
                        <strong>📝 Your Submitted Answer</strong>
                        {q.submitted_at && (
                          <span className="submission-time">
                            {new Date(q.submitted_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      <div className="solution-content">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({node, inline, className, children, ...props}) {
                              return inline ? (
                                <code className="inline-code" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="code-block">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              );
                            }
                          }}
                        >
                          {q.student_solution}
                        </ReactMarkdown>
                      </div>
                      
                      <div className="solution-status-row">
                        <span className={`solution-status ${
                          q.is_correct === true ? 'correct' : 
                          q.is_correct === false ? 'incorrect' : 
                          'pending'
                        }`}>
                          {q.is_correct === true ? '✓ Correct' : 
                           q.is_correct === false ? '✗ Incorrect' : 
                           '○ Pending Review'}
                        </span>
                        
                        {q.attempts > 0 && (
                          <span className="attempts-badge">
                            Submission #{q.attempts}
                          </span>
                        )}
                      </div>
                      
                      {q.feedback && (
                        <div className="instructor-feedback">
                          <strong>💬 Instructor Feedback:</strong>
                          <p>{q.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="question-card-actions">
                    <button
                      onClick={() => openQuestionChat(q.question_id, q.number || (idx + 1), false)}
                      className="work-on-question-button"
                    >
                      💬 {q.student_solution ? 'Continue Working' : 'Work on this Question'}
                    </button>
                    
                    {q.chat_id && (
                      <button
                        onClick={() => openQuestionChat(q.question_id, q.number || (idx + 1), true)}
                        className="new-chat-button-small"
                      >
                        🔄 New Chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-questions">No questions available</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="assignments-container">
      <div className="assignments-header">
        <h2>My Assignments</h2>
      </div>
      
      {assignments.length === 0 ? (
        <div className="no-assignments">
          <p>No assignments yet. Your instructor will assign work here.</p>
        </div>
      ) : (
        <div className="assignments-grid">
          {assignments.map((assignment) => (
            <div key={assignment.assignment_id} className="assignment-card">
              <div className="assignment-card-content">
                <h3>{assignment.title}</h3>
                <p className="assignment-description">{assignment.description}</p>
                <span className="assignment-meta">
                  {assignment.total_questions} question(s)
                </span>
              </div>

              <div className="assignment-card-actions">
                {assignment.accepted ? (
                  <>
                    <span className="accepted-badge">Accepted</span>
                    <button
                      onClick={() => loadAssignmentDetails(assignment.assignment_id)}
                      className="view-button"
                    >
                      View
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => acceptAssignment(assignment.assignment_id)}
                    className="accept-button"
                  >
                    Accept Assignment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}