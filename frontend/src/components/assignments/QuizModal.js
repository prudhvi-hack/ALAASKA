import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../api/axios';
import '../../styles/quiz.css';

export default function QuizModal({ 
  assignmentId, 
  quizType, // 'pre' or 'post'
  onClose, 
  onComplete 
}) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, [assignmentId, quizType]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const endpoint = quizType === 'pre' 
        ? `/assignments/${assignmentId}/pre-quiz`
        : `/assignments/${assignmentId}/post-quiz`;
      
      const res = await api.get(endpoint);
      
      if (res.data.completed) {
        // Already completed
        setResults({
          score: res.data.score,
          completed: true,
          message: `You've already completed this ${quizType}-quiz with a score of ${res.data.score.toFixed(1)}%`
        });
      } else {
        setQuiz(res.data.quiz);
        // Initialize selected answers
        const initialAnswers = {};
        res.data.quiz.questions.forEach(q => {
          initialAnswers[q.question_id] = null;
        });
        setSelectedAnswers(initialAnswers);
      }
    } catch (err) {
      console.error('Failed to load quiz:', err);
      setError(err.response?.data?.detail || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId, optionId) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleSubmit = async () => {
    // Validate all questions answered
    const unanswered = Object.entries(selectedAnswers).filter(([_, optionId]) => !optionId);
    if (unanswered.length > 0) {
      alert(`Please answer all questions before submitting. ${unanswered.length} question(s) remaining.`);
      return;
    }

    if (!window.confirm(`Submit your ${quizType}-quiz? You cannot change your answers after submission.`)) {
      return;
    }

    try {
      setSubmitting(true);
      const endpoint = quizType === 'pre'
        ? `/assignments/${assignmentId}/pre-quiz/submit`
        : `/assignments/${assignmentId}/post-quiz/submit`;

      const answers = Object.entries(selectedAnswers).map(([question_id, selected_option_id]) => ({
        question_id,
        selected_option_id
      }));

      const res = await api.post(endpoint, answers);
      
      setResults({
        score: res.data.score,
        correct_count: res.data.correct_count,
        total_questions: res.data.total_questions,
        results: res.data.results,
        completed: true
      });

      // Notify parent component
      if (onComplete) {
        onComplete(res.data);
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      alert(err.response?.data?.detail || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="quiz-modal-overlay">
        <div className="quiz-modal">
          <div className="quiz-loading">
            <p>Loading quiz...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-modal-overlay">
        <div className="quiz-modal">
          <div className="quiz-error">
            <p>{error}</p>
            <button onClick={onClose} className="quiz-close-button">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <div className="quiz-modal-overlay">
        <div className="quiz-modal quiz-results-modal">
          <div className="quiz-header">
            <h2>Quiz Results</h2>
          </div>

          <div className="quiz-results-summary">
            <div className="score-circle">
              <span className="score-number">{results.score.toFixed(1)}%</span>
            </div>
            <p className="results-message">
              You got {results.correct_count} out of {results.total_questions} questions correct!
            </p>
          </div>

          {results.results && (
            <div className="quiz-results-detailed">
              <h3>Detailed Results</h3>
              {results.results.map((result, idx) => {
                const question = quiz?.questions.find(q => q.question_id === result.question_id);
                
                return (
                  <div key={idx} className={`result-item ${result.is_correct ? 'correct' : 'incorrect'}`}>
                    <div className="result-header">
                      <span className="result-status">
                        {result.is_correct ? '✓' : '✗'}
                      </span>
                      <span className="result-question-number">Question {idx + 1}</span>
                    </div>
                    
                    {question && (
                      <>
                        <p className="result-question-text">{question.question_text}</p>
                        
                        <div className="result-options">
                          {question.options.map(opt => (
                            <div 
                              key={opt.option_id}
                              className={`result-option ${
                                opt.option_id === result.correct_option_id ? 'correct-answer' : ''
                              } ${
                                opt.option_id === result.selected_option_id && !result.is_correct ? 'wrong-answer' : ''
                              }`}
                            >
                              {opt.option_id === result.selected_option_id && <span>→ </span>}
                              {opt.text}
                              {opt.option_id === result.correct_option_id && <span className="correct-badge"> ✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                        
                        {result.explanation && (
                          <div className="result-explanation">
                            <strong>Explanation:</strong>
                            <p>{result.explanation}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="quiz-actions">
            <button onClick={onClose} className="quiz-close-button">
              {quizType === 'pre' ? 'Continue to Assignment' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-modal-overlay">
      <div className="quiz-modal">
        <div className="quiz-header">
          <h2>{quiz.title}</h2>
          <button onClick={onClose} className="quiz-close-x">×</button>
        </div>

        {/* OT GRADED BANNER */}
        <div className="quiz-info-banner">
          <span className="info-icon">ℹ️</span>
          <div>
            <strong>This quiz is NOT graded</strong>
            <p>It's for self-assessment only. You'll see correct answers immediately after submission.</p>
          </div>
        </div>

        {quiz.description && (
          <p className="quiz-description">{quiz.description}</p>
        )}

        <div className="quiz-questions">
          {quiz.questions.map((question, qIdx) => (
            <div key={question.question_id} className="quiz-question">
              <h3 className="quiz-question-title">
                Question {qIdx + 1} of {quiz.questions.length}
              </h3>
              
              <div className="quiz-question-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {question.question_text}
                </ReactMarkdown>
              </div>

              <div className="quiz-options">
                {question.options.map((option) => (
                  <label
                    key={option.option_id}
                    className={`quiz-option ${
                      selectedAnswers[question.question_id] === option.option_id ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.question_id}`}
                      value={option.option_id}
                      checked={selectedAnswers[question.question_id] === option.option_id}
                      onChange={() => handleAnswerSelect(question.question_id, option.option_id)}
                    />
                    <span className="quiz-option-text">{option.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="quiz-actions">
          <button onClick={onClose} className="quiz-cancel-button">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={submitting || Object.values(selectedAnswers).some(v => !v)}
            className="quiz-submit-button"
          >
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}