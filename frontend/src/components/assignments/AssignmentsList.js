import React, { useState } from 'react';
import api from '../../api/axios';
import QuizModal from './QuizModal';

export default function AssignmentsList({ 
  assignments, 
  onLoadAssignmentDetails,
  onRefresh 
}) {
  const [showQuiz, setShowQuiz] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  const handleAcceptAssignment = async (assignmentId, hasPreQuiz) => {
    if (hasPreQuiz) {
      setShowQuiz({ assignmentId, type: 'pre' });
    } else {
      await acceptAssignment(assignmentId);
    }
  };

  const acceptAssignment = async (assignmentId) => {
    try {
      await api.post(`/assignments/${assignmentId}/accept`);
      alert('Assignment accepted!');
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept assignment');
    }
  };

  const handlePreQuizComplete = async (assignmentId) => {
    setShowQuiz(null);
    await acceptAssignment(assignmentId);
  };

  // : Handle submit with automatic post-quiz modal
  const handlePostQuizComplete = (assignmentId) => {
    setShowQuiz(null);
    onRefresh(); // Refresh to get updated post_quiz_completed status
    // Retry submission after completing post-quiz
    setTimeout(() => {
      const updatedAssignment = assignments.find(a => a.assignment_id === assignmentId);
      if (updatedAssignment) {
        handleSubmitFromList(updatedAssignment);
      }
    }, 500);
  };

    const handleSubmitFromList = async (assignment) => {
    const { assignment_id, total_questions, questions_answered, has_post_quiz, submitted, post_quiz_completed } = assignment;
    
    console.log('Submit clicked:', { assignment_id, has_post_quiz, post_quiz_completed, submitted }); // Debug log
    
    // Check if already submitted
    if (submitted) {
      alert('This assignment has already been submitted.');
      return;
    }

    if (!assignment.submissions_enabled) {
      alert('Submissions are currently disabled for this assignment.');
      return;
    }
    
    // STEP 1: Check if all questions answered (show warning FIRST)
    if (questions_answered < total_questions) {
      const confirmed = window.confirm(
        `You have only answered ${questions_answered} out of ${total_questions} questions.\n\nAre you sure you want to submit?`
      );
      if (!confirmed) return;
    }
    
    // EP 2: Check post-quiz requirement (show modal if not completed)
    if (has_post_quiz && !post_quiz_completed) {
      console.log('Opening post-quiz modal'); // Debug log
      setShowQuiz({ assignmentId: assignment_id, type: 'post' });
      return; // Stop here, will continue after quiz completion
    }
    
    // P 3: Submit assignment
    try {
      setSubmitting(assignment_id);
      console.log('Submitting assignment:', assignment_id); // Debug log
      const res = await api.post(`/assignments/${assignment_id}/submit`);
      alert(`Assignment submitted successfully!\n\n${res.data.questions_answered}/${res.data.total_questions} questions answered`);
      onRefresh();
    } catch (err) {
      console.error('Submit error:', err); // Debug log
      alert(err.response?.data?.detail || 'Failed to submit assignment');
    } finally {
      setSubmitting(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="no-assignments">
        <p>No assignments yet. Your instructor will assign work here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="assignments-grid">
        {assignments.map((assignment) => (
          <div key={assignment.assignment_id} className="assignment-card">
            <div className="assignment-card-content">
              <h3>{assignment.title}</h3>
              <p className="assignment-description">{assignment.description}</p>
              
              <div className="assignment-meta-row">
                <span className="assignment-meta">
                  {assignment.total_questions} question(s)
                </span>
                
                {assignment.has_pre_quiz && !assignment.accepted && (
                  <span className="quiz-badge pre-quiz-badge">
                    📝 Pre-Quiz Required
                  </span>
                )}
                
                {/* EBUG: Show post-quiz status */}
                {assignment.has_post_quiz && assignment.accepted && (
                  <span className={`quiz-badge ${assignment.post_quiz_completed ? 'post-quiz-completed' : 'post-quiz-pending'}`}>
                    {assignment.post_quiz_completed ? '✓ Post-Quiz Done' : '⏳ Post-Quiz Pending'}
                  </span>
                )}
              </div>

              {/* Submission Status */}
              {assignment.submitted && (
                <div className="submission-status-badge">
                  ✓ Submitted on {new Date(assignment.submitted_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="assignment-card-actions">
              {assignment.accepted ? (
                <>
                  <button
                    onClick={() => onLoadAssignmentDetails(assignment.assignment_id)}
                    className="view-button"
                  >
                    View
                  </button>
                  
                  {/* Submit Button (only show if not submitted) */}
                  {!assignment.submitted && (
                    <button
                      onClick={() => handleSubmitFromList(assignment)}
                      disabled={submitting === assignment.assignment_id || !assignment.submissions_enabled }
                      className="submit-button-small first-submit"
                      title={!assignment.submissions_enabled ? 'Submissions are currently disabled' : ''}
                    >
                      {submitting === assignment.assignment_id ? 'Submitting...' : 'Submit'}
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleAcceptAssignment(assignment.assignment_id, assignment.has_pre_quiz)}
                  className="accept-button"
                >
                  {assignment.has_pre_quiz ? 'Take Pre-Quiz & Accept' : 'Accept Assignment'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showQuiz && (
        <QuizModal
          assignmentId={showQuiz.assignmentId}
          quizType={showQuiz.type}
          onClose={() => setShowQuiz(null)}
          onComplete={() => {
            if (showQuiz.type === 'pre') {
              handlePreQuizComplete(showQuiz.assignmentId);
            } else {
              handlePostQuizComplete(showQuiz.assignmentId);
            }
          }}
        />
      )}
    </>
  );
}