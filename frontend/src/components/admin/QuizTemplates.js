import React, { useState } from 'react';
import api from '../../api/axios';

export default function QuizTemplates({ quizTemplates, loading, onUpdate, showNotification }) {
  const [busy, setBusy] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    questions: [{
      question_text: '',
      options: [
        { text: '', is_correct: false },
        { text: '', is_correct: false }
      ],
      explanation: ''
    }]
  });

  const addQuizQuestion = () => {
    setQuizForm({
      ...quizForm,
      questions: [...quizForm.questions, {
        question_text: '',
        options: [
          { text: '', is_correct: false },
          { text: '', is_correct: false }
        ],
        explanation: ''
      }]
    });
  };

  const removeQuizQuestion = (index) => {
    const newQuestions = quizForm.questions.filter((_, i) => i !== index);
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const updateQuizQuestion = (qIdx, field, value) => {
    const newQuestions = [...quizForm.questions];
    newQuestions[qIdx] = { ...newQuestions[qIdx], [field]: value };
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const addQuizOption = (qIdx) => {
    const newQuestions = [...quizForm.questions];
    newQuestions[qIdx].options.push({ text: '', is_correct: false });
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const removeQuizOption = (qIdx, optIdx) => {
    const newQuestions = [...quizForm.questions];
    newQuestions[qIdx].options = newQuestions[qIdx].options.filter((_, i) => i !== optIdx);
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const updateQuizOption = (qIdx, optIdx, field, value) => {
    const newQuestions = [...quizForm.questions];
    
    if (field === 'is_correct' && value) {
      newQuestions[qIdx].options.forEach((opt, i) => {
        opt.is_correct = i === optIdx;
      });
    } else {
      newQuestions[qIdx].options[optIdx] = { ...newQuestions[qIdx].options[optIdx], [field]: value };
    }
    
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const validateQuiz = (form) => {
    if (!form.title.trim()) {
      return { ok: false, message: 'Please enter a quiz title' };
    }

    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      
      if (!q.question_text.trim()) {
        return { ok: false, message: `Please enter text for question ${i + 1}` };
      }

      if (q.options.length < 2) {
        return { ok: false, message: `Question ${i + 1} needs at least 2 options` };
      }

      const hasCorrect = q.options.some(opt => opt.is_correct);
      if (!hasCorrect) {
        return { ok: false, message: `Please mark the correct answer for question ${i + 1}` };
      }

      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim()) {
          return { ok: false, message: `Please fill in option ${j + 1} for question ${i + 1}` };
        }
      }
    }

    return { ok: true };
  };

  const createQuizTemplate = async () => {
    const validation = validateQuiz(quizForm);
    if (!validation.ok) {
      showNotification(validation.message, 'error');
      return;
    }

    try {
      setBusy(true);
      await api.post('/quiz-templates', quizForm);
      showNotification('Quiz template created successfully');
      setQuizForm({
        title: '',
        description: '',
        questions: [{
          question_text: '',
          options: [
            { text: '', is_correct: false },
            { text: '', is_correct: false }
          ],
          explanation: ''
        }]
      });
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to create quiz template', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteQuizTemplate = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz template?')) {
      return;
    }

    try {
      setBusy(true);
      await api.delete(`/quiz-templates/${quizId}`);
      showNotification('Quiz template deleted successfully');
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to delete quiz template', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-section">
      <h2>Create Quiz Template (MCQ)</h2>
      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Create multiple-choice quizzes for pre/post assessment. These quizzes are <strong>self-graded</strong> and provide immediate feedback to students.
      </p>

      <div className="quiz-form">
        <input
          type="text"
          placeholder="Quiz Title (e.g., 'Data Structures Pre-Quiz')"
          value={quizForm.title}
          onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
          className="admin-input"
        />

        <textarea
          placeholder="Quiz Description (optional)"
          value={quizForm.description}
          onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
          className="admin-textarea"
          rows="2"
        />

        <h3>Questions</h3>
        {quizForm.questions.map((question, qIdx) => (
          <div key={qIdx} className="quiz-question-form">
            <div className="question-header">
              <h4>Question {qIdx + 1}</h4>
              {quizForm.questions.length > 1 && (
                <button onClick={() => removeQuizQuestion(qIdx)} className="remove-button-small">
                  Remove Question
                </button>
              )}
            </div>

            <textarea
              placeholder="Question text"
              value={question.question_text}
              onChange={(e) => updateQuizQuestion(qIdx, 'question_text', e.target.value)}
              className="admin-textarea"
              rows="2"
            />

            <div className="quiz-options-section">
              <h5>Answer Options</h5>
              {question.options.map((option, optIdx) => (
                <div key={optIdx} className="quiz-option-row">
                  <input
                    type="checkbox"
                    checked={option.is_correct}
                    onChange={(e) => updateQuizOption(qIdx, optIdx, 'is_correct', e.target.checked)}
                    title="Mark as correct answer"
                  />
                  <input
                    type="text"
                    placeholder={`Option ${optIdx + 1}`}
                    value={option.text}
                    onChange={(e) => updateQuizOption(qIdx, optIdx, 'text', e.target.value)}
                    className="admin-input"
                  />
                  {question.options.length > 2 && (
                    <button
                      onClick={() => removeQuizOption(qIdx, optIdx)}
                      className="remove-button-small"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => addQuizOption(qIdx)} className="add-button-small">
                + Add Option
              </button>
            </div>

            <textarea
              placeholder="Explanation (shown after answering)"
              value={question.explanation}
              onChange={(e) => updateQuizQuestion(qIdx, 'explanation', e.target.value)}
              className="admin-textarea"
              rows="2"
            />
          </div>
        ))}

        <button onClick={addQuizQuestion} className="add-button">
          + Add Question
        </button>

        <button onClick={createQuizTemplate} disabled={busy || loading} className="admin-button">
          {busy ? 'Creating...' : 'Create Quiz Template'}
        </button>
      </div>

      <div className="quizzes-list">
        <h3>Existing Quiz Templates ({quizTemplates.length})</h3>
        {quizTemplates.map((quiz, idx) => (
          <div key={idx} className="quiz-card">
            <div>
              <h4>{quiz.title}</h4>
              {quiz.description && <p>{quiz.description}</p>}
              <span className="quiz-meta">{quiz.questions?.length || 0} questions</span>
            </div>
            <button
              onClick={() => deleteQuizTemplate(quiz.quiz_id)}
              className="remove-button"
              disabled={busy || loading}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}