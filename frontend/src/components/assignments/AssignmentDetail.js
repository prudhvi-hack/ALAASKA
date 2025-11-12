import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import api from '../../api/axios';
import QuizModal from './QuizModal';

export default function AssignmentDetail({ 
  assignment, 
  loadingDetails,
  onBack,
  autoScrollToQuestionId,
  onRefresh
}) {
  const [showQuiz, setShowQuiz] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const openQuestionChat = async (questionId, questionNumber, reset = false) => {
    try {
      if (reset) {
        const confirmed = window.confirm(
          `Start a new chat for Question ${questionNumber}? Your current conversation will be saved in history.`
        );
        if (!confirmed) return;
      }
      
      const res = await api.get(
        `/assignments/${assignment.assignment_id}/questions/${questionId}/chat`,
        { params: { reset } }
      );
      
      if (reset) {
        alert('New chat started! Your previous conversation is saved.');
      }
      
      window.location.href = `/?chat_id=${res.data.chat_id}&submissions_enabled=${assignment.submissions_enabled}`;
    } catch (err) {
      console.error('Failed to open question chat:', err);
      alert(err.response?.data?.detail || 'Failed to open question chat');
    }
  };

  const handlePostQuizComplete = () => {
    setShowQuiz(null);
    if (onRefresh) onRefresh();
    handleSubmitAssignment();
  };

  const handleSubmitAssignment = async () => {
    const questionsAnswered = assignment.questions_answered || 0;
    const totalQuestions = assignment.total_questions || 0;
    
    if (assignment.submitted) {
      alert('This assignment has already been submitted.');
      return;
    }
    
    if (questionsAnswered < totalQuestions) {
      const confirmed = window.confirm(
        `You have only answered ${questionsAnswered} out of ${totalQuestions} questions.\n\nAre you sure you want to submit?`
      );
      if (!confirmed) return;
    }
    
    if (assignment.has_post_quiz && !assignment.post_quiz_completed) {
      setShowQuiz({ assignmentId: assignment.assignment_id, type: 'post' });
      return;
    }
    
    try {
      setSubmitting(true);
      const res = await api.post(`/assignments/${assignment.assignment_id}/submit`);
      alert(
        `Assignment submitted successfully!\n\n` +
        `${res.data.questions_answered}/${res.data.total_questions} questions answered`
      );
      
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ NEW: Preprocess LaTeX for rendering
  const preprocessLatex = (text) => {
    if (!text) return text;
    
    return text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
  };

  // ✅ NEW: Reusable Markdown component with LaTeX support
  const MarkdownContent = ({ children }) => (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
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
      {preprocessLatex(children)}
    </ReactMarkdown>
  );

  React.useEffect(() => {
    if (assignment && autoScrollToQuestionId) {
      setTimeout(() => {
        const questionCard = document.querySelector(`[data-question-id="${autoScrollToQuestionId}"]`);
        if (questionCard) {
          questionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          questionCard.classList.add('highlight-question');
          setTimeout(() => questionCard.classList.remove('highlight-question'), 2000);
        }
      }, 300);
    }
  }, [assignment, autoScrollToQuestionId]);

  const questionsAnswered = assignment.questions_answered || 0;
  const totalQuestions = assignment.total_questions || 0;
  const isSubmitted = assignment.submitted;

  return (
    <>
      <div className="assignment-detail-container">
        <button onClick={onBack} className="back-button">
          ← Back to Assignments
        </button>

        <div className="assignment-detail-header">
          <div className="header-top-row">
            <div>
              <h2>{assignment.title}</h2>
              <p className="assignment-description">{assignment.description}</p>
            </div>
            
            {!isSubmitted && (
              <div className="header-actions">
                <button
                  onClick={handleSubmitAssignment}
                  disabled={submitting || !assignment.submissions_enabled }
                  className="submit-assignment-button first-submit"
                >
                  {submitting ? 'Submitting...' : 'Submit Assignment'}
                </button>
              </div>
            )}
          </div>

          {isSubmitted && (
            <div className="submission-info-banner">
              <span className="info-icon">✓</span>
              <div>
                <strong>Assignment Submitted</strong>
                <p>
                  Submitted on: {new Date(assignment.submitted_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="progress-indicator">
            <span className="progress-text">
              Progress: {questionsAnswered}/{totalQuestions} questions answered
            </span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(questionsAnswered / totalQuestions) * 100}%` }}
              />
            </div>
          </div>
          
          {assignment.has_post_quiz && assignment.post_quiz_completed && !isSubmitted && (
            <div className="completion-badge">
              ✓ Post-Quiz Completed - Ready to Submit
            </div>
          )}
        </div>
        {!assignment.submissions_enabled && (
        <div className="submission-info-banner" style={{ background: '#fff3cd', borderColor: '#ffc107' }}>
          <span className="info-icon">⚠️</span>
          <div>
            <strong>Submissions Disabled</strong>
            <p>The instructor has disabled submissions for this assignment.</p>
          </div>
        </div>
      )}

        <div className="assignment-questions-section">
          <h3>Questions</h3>

          {loadingDetails ? (
            <p className="loading-text">Loading questions...</p>
          ) : assignment.questions && assignment.questions.length > 0 ? (
            <div className="questions-grid">
              {assignment.questions.map((q, idx) => (
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
                  
                  {/* ✅ FIXED: Use MarkdownContent with LaTeX support */}
                  <div className="question-text">
                    <MarkdownContent>
                      {q.prompt_md || q.question_text || 'No question text available'}
                    </MarkdownContent>
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
                      
                      {/* ✅ FIXED: Use MarkdownContent with LaTeX support */}
                      <div className="solution-content">
                        <MarkdownContent>
                          {q.student_solution}
                        </MarkdownContent>
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

        {!isSubmitted && (
          <div className="assignment-footer">
            <button
              onClick={handleSubmitAssignment}
              disabled={submitting || !assignment.submissions_enabled}
              className="submit-assignment-button large first-submit"
            >
              {submitting ? 'Submitting...' : 'Submit Assignment'}
            </button>
          </div>
        )}
      </div>

      {showQuiz && (
        <QuizModal
          assignmentId={showQuiz.assignmentId}
          quizType={showQuiz.type}
          onClose={() => setShowQuiz(null)}
          onComplete={handlePostQuizComplete}
        />
      )}
    </>
  );
}