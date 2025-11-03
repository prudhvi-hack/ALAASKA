import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = '';

export default function AssignmentsPage({ getToken }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const assignmentsList = res.data.assignments || res.data || [];
      setAssignments(assignmentsList);
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
      const token = await getToken();
      await axios.post(
        `${BACKEND_URL}/assignments/${assignmentId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Assignment accepted! Conversations created for each question.');
      loadAssignments();
    } catch (err) {
      console.error('Failed to accept assignment:', err);
      alert(err.response?.data?.detail || 'Failed to accept assignment');
    }
  };

  const loadAssignmentDetails = async (assignmentId) => {
    try {
      setLoadingDetails(true);
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedAssignment(res.data);
    } catch (err) {
      console.error('Failed to load assignment details:', err);
      alert(err.response?.data?.detail || 'Failed to load assignment details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const openQuestionChat = async (questionId, questionNumber) => {
    try {
      const token = await getToken();
      const res = await axios.get(
        `${BACKEND_URL}/assignments/${selectedAssignment.assignment_id}/questions/${questionId}/chat`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Store the chat_id and token in sessionStorage so App.js can use it
      sessionStorage.setItem('assignment_chat_id', res.data.chat_id);
      sessionStorage.setItem('assignment_chat_token', token);
      
      // Redirect to chat view - App.js will pick this up
      window.location.href = `/?chat_id=${res.data.chat_id}&assignment=true`;
    } catch (err) {
      console.error('Failed to open question chat:', err);
      alert('Failed to open question chat');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <p>{error}</p>
        <button onClick={loadAssignments}>Retry</button>
      </div>
    );
  }

  if (selectedAssignment) {
    return (
      <div style={{ 
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        padding: '2rem',
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <button 
          onClick={() => setSelectedAssignment(null)}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to Assignments
        </button>

        <div style={{ 
          background: 'white', 
          padding: '2rem', 
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>{selectedAssignment.title}</h2>
          <p style={{ color: '#666', margin: 0 }}>{selectedAssignment.description}</p>
        </div>

        <h3 style={{ marginBottom: '1rem' }}>Questions</h3>

        {loadingDetails ? (
          <p>Loading questions...</p>
        ) : selectedAssignment.questions && selectedAssignment.questions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {selectedAssignment.questions.map((q, idx) => (
              <div 
                key={q.question_id || idx} 
                style={{
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: '#333' }}>
                    Question {q.number || (idx + 1)}
                  </h4>
                  {q.marks && (
                    <span style={{ 
                      background: '#e3f2fd', 
                      color: '#1976d2', 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}>
                      {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                    </span>
                  )}
                </div>
                
                <div 
                  style={{ 
                    fontSize: '1.1rem', 
                    lineHeight: '1.6', 
                    marginBottom: '1rem',
                    whiteSpace: 'pre-wrap'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: q.prompt_md || q.question_text || 'No question text available' 
                  }}
                />
                
                {q.hints && q.hints.length > 0 && (
                  <details style={{ marginBottom: '1rem' }}>
                    <summary style={{ 
                      cursor: 'pointer', 
                      color: 'lightseagreen',
                      fontWeight: '500',
                      marginBottom: '0.5rem'
                    }}>
                      💡 Show Hints ({q.hints.length})
                    </summary>
                    <ul style={{ paddingLeft: '1.5rem', color: '#666' }}>
                      {q.hints.map((hint, hIdx) => (
                        <li key={hIdx} style={{ marginBottom: '0.5rem' }}>{hint}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <button
                  onClick={() => openQuestionChat(q.question_id, q.number || (idx + 1))}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'lightseagreen',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '1rem',
                    marginTop: '1rem'
                  }}
                >
                  💬 Work on this Question
                </button>

                {q.student_solution && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    background: '#f9f9f9', 
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Your Solution:
                    </strong>
                    <p style={{ margin: '0 0 0.5rem 0' }}>{q.student_solution}</p>
                    <span style={{ 
                      color: q.is_correct ? 'green' : 'orange',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {q.is_correct ? '✓ Correct' : '○ Submitted - Pending Review'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#666' }}>No questions available</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      height: 'calc(100vh - 140px)',
      overflowY: 'auto',
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <h2>My Assignments</h2>
      
      {assignments.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
          No assignments yet. Your instructor will assign work here.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          {assignments.map((assignment) => (
            <div 
              key={assignment.assignment_id}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>{assignment.title}</h3>
                <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>
                  {assignment.description}
                </p>
                <span style={{ fontSize: '0.9rem', color: '#888' }}>
                  {assignment.total_questions} question(s)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {assignment.accepted ? (
                  <>
                    <span style={{ 
                      padding: '0.5rem 1rem',
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      Accepted
                    </span>
                    <button
                      onClick={() => loadAssignmentDetails(assignment.assignment_id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'lightseagreen',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      View
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => acceptAssignment(assignment.assignment_id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
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