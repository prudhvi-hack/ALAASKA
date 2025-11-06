import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';
import '../styles/assignments.css';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/assignments');
      setAssignments(res.data.assignments || res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load assignments:', err);
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

  const openQuestionChat = async (questionId, questionNumber, reset = false) => {
    try {
      console.log(`[AssignmentsPage] ${reset ? 'Resetting' : 'Opening'} chat for question:`, questionId);
      
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
      
      console.log('[AssignmentsPage] Got chat_id:', res.data.chat_id);
      
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
        <button onClick={() => setSelectedAssignment(null)} className="back-button">
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
                <div key={q.question_id || idx} className="question-card">
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
                  
                  {q.hints && q.hints.length > 0 && q.hints.some(hint => hint && hint.trim()) && (  // ✅ Added check for non-empty hints
                  <details className="hints-section">
                    <summary className="hints-summary">
                      💡 Show Hints ({q.hints.filter(h => h && h.trim()).length})  // ✅ Count only non-empty hints
                    </summary>
                    <ul className="hints-list">
                      {q.hints
                        .filter(hint => hint && hint.trim())  // ✅ Filter out empty hints
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