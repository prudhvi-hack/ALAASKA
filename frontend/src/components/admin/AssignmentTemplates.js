import React, { useState } from 'react';
import api from '../../api/axios';

export default function AssignmentTemplates({ templates, loading, onUpdate, showNotification }) {
  const [busy, setBusy] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    questions: [{ number: '', prompt_md: '', marks: 1, hints: [] }]
  });

  const [editTemplateForm, setEditTemplateForm] = useState({
    title: '',
    description: '',
    questions: []
  });

  const addQuestion = () => {
    setTemplateForm({
      ...templateForm,
      questions: [...templateForm.questions, { number: '', prompt_md: '', marks: 1, hints: [] }]
    });
  };

  const removeQuestion = (index) => {
    const newQuestions = templateForm.questions.filter((_, i) => i !== index);
    setTemplateForm({ ...templateForm, questions: newQuestions });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...templateForm.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setTemplateForm({ ...templateForm, questions: newQuestions });
  };

  const addHint = (questionIndex) => {
    const newQuestions = [...templateForm.questions];
    newQuestions[questionIndex].hints.push('');
    setTemplateForm({ ...templateForm, questions: newQuestions });
  };

  const removeHint = (questionIndex, hintIndex) => {
    const newQuestions = [...templateForm.questions];
    newQuestions[questionIndex].hints = newQuestions[questionIndex].hints.filter((_, i) => i !== hintIndex);
    setTemplateForm({ ...templateForm, questions: newQuestions });
  };

  const updateHint = (questionIndex, hintIndex, value) => {
    const newQuestions = [...templateForm.questions];
    newQuestions[questionIndex].hints[hintIndex] = value;
    setTemplateForm({ ...templateForm, questions: newQuestions });
  };

  const validateTemplate = (form) => {
    const numRe = /^\d+(\.\d+)*$/;
    const seen = new Set();
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.number || !q.number.trim()) {
        return { ok: false, message: `Please enter a question number for question ${i + 1}.` };
      }
      const num = q.number.trim();
      if (!numRe.test(num)) {
        return { ok: false, message: `Invalid question number "${num}". Use formats like 1 or 1.1.` };
      }
      if (seen.has(num)) {
        return { ok: false, message: `Duplicate question number "${num}".` };
      }
      seen.add(num);
      if (!q.prompt_md || !q.prompt_md.trim()) {
        return { ok: false, message: `Please enter text for question ${num}.` };
      }
      if (!q.marks || q.marks <= 0) {
        return { ok: false, message: `Please enter valid marks for question ${num}.` };
      }
    }
    if (!form.title.trim() || !form.description.trim()) {
      return { ok: false, message: 'Please fill in title and description' };
    }
    return { ok: true };
  };

  const createTemplate = async () => {
    const validation = validateTemplate(templateForm);
    if (!validation.ok) {
      showNotification(validation.message, 'error');
      return;
    }

    try {
      setBusy(true);
      const payload = {
        title: templateForm.title,
        description: templateForm.description,
        questions: templateForm.questions.map(q => ({
          number: q.number.trim(),
          prompt_md: q.prompt_md,
          marks: parseFloat(q.marks),
          hints: q.hints.filter(h => h && h.trim() !== '')
        }))
      };

      await api.post('/assignment-templates', payload);
      showNotification('Template created successfully');
      setTemplateForm({
        title: '',
        description: '',
        questions: [{ number: '', prompt_md: '', marks: 1, hints: [] }]
      });
      onUpdate();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to create template';
      showNotification(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const startEditTemplate = (template) => {
    setEditingTemplate(template.template_id);
    setEditTemplateForm({
      title: template.title,
      description: template.description,
      questions: template.questions.map(q => ({
        question_id: q.question_id,
        number: q.number,
        prompt_md: q.prompt_md,
        marks: q.marks,
        hints: q.hints || []
      }))
    });
  };

  const cancelEditTemplate = () => {
    setEditingTemplate(null);
    setEditTemplateForm({
      title: '',
      description: '',
      questions: []
    });
  };

  const updateTemplate = async () => {
    const validation = validateTemplate(editTemplateForm);
    if (!validation.ok) {
      showNotification(validation.message, 'error');
      return;
    }

    try {
      setBusy(true);
      const payload = {
        title: editTemplateForm.title,
        description: editTemplateForm.description,
        questions: editTemplateForm.questions.map(q => ({
          question_id: q.question_id,
          number: q.number.trim(),
          prompt_md: q.prompt_md,
          marks: parseFloat(q.marks),
          hints: q.hints.filter(h => h && h.trim() !== '')
        }))
      };

      await api.put(`/assignment-templates/${editingTemplate}`, payload);
      showNotification('Template updated successfully');
      cancelEditTemplate();
      onUpdate();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update template';
      showNotification(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template? This cannot be undone.')) {
      return;
    }

    try {
      setBusy(true);
      await api.delete(`/assignment-templates/${templateId}`);
      showNotification('Template deleted successfully');
      onUpdate();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete template';
      showNotification(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateEditTemplateQuestion = (index, field, value) => {
    const newQuestions = [...editTemplateForm.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setEditTemplateForm({ ...editTemplateForm, questions: newQuestions });
  };

  const addEditTemplateQuestion = () => {
    setEditTemplateForm({
      ...editTemplateForm,
      questions: [...editTemplateForm.questions, { 
        question_id: '',
        number: '', 
        prompt_md: '', 
        marks: 1, 
        hints: [] 
      }]
    });
  };

  const removeEditTemplateQuestion = (index) => {
    const newQuestions = editTemplateForm.questions.filter((_, i) => i !== index);
    setEditTemplateForm({ ...editTemplateForm, questions: newQuestions });
  };

  const addEditTemplateHint = (questionIndex) => {
    const newQuestions = [...editTemplateForm.questions];
    newQuestions[questionIndex].hints.push('');
    setEditTemplateForm({ ...editTemplateForm, questions: newQuestions });
  };

  const removeEditTemplateHint = (questionIndex, hintIndex) => {
    const newQuestions = [...editTemplateForm.questions];
    newQuestions[questionIndex].hints = newQuestions[questionIndex].hints.filter((_, i) => i !== hintIndex);
    setEditTemplateForm({ ...editTemplateForm, questions: newQuestions });
  };

  const updateEditTemplateHint = (questionIndex, hintIndex, value) => {
    const newQuestions = [...editTemplateForm.questions];
    newQuestions[questionIndex].hints[hintIndex] = value;
    setEditTemplateForm({ ...editTemplateForm, questions: newQuestions });
  };

  return (
    <div className="admin-section">
      <h2>Create Assignment Template</h2>
      
      <div className="template-form">
        <input
          type="text"
          placeholder="Template Title"
          value={templateForm.title}
          onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
          className="admin-input"
        />
        
        <textarea
          placeholder="Template Description"
          value={templateForm.description}
          onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
          className="admin-textarea"
          rows="3"
        />

        <h3>Questions</h3>
        {templateForm.questions.map((question, qIdx) => (
          <div key={qIdx} className="question-form">
            <div className="question-header">
              <h4>Question {qIdx + 1}</h4>
              {templateForm.questions.length > 1 && (
                <button onClick={() => removeQuestion(qIdx)} className="remove-button-small">
                  Remove Question
                </button>
              )}
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Question Number</label>
              <input
                type="text"
                placeholder="e.g., 1 or 1.1"
                value={question.number}
                onChange={(e) => updateQuestion(qIdx, 'number', e.target.value)}
                className="admin-input"
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Marks</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={question.marks}
                onChange={(e) => updateQuestion(qIdx, 'marks', e.target.value)}
                className="admin-input"
              />
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Question Text</label>
              <textarea
                placeholder="Question text (Markdown supported)"
                value={question.prompt_md}
                onChange={(e) => updateQuestion(qIdx, 'prompt_md', e.target.value)}
                className="admin-textarea"
                rows="3"
              />
            </div>

            <div className="hints-section">
              <h5>Hints (optional)</h5>
              {question.hints.map((hint, hIdx) => (
                <div key={hIdx} className="hint-input-group">
                  <input
                    type="text"
                    placeholder={`Hint ${hIdx + 1}`}
                    value={hint}
                    onChange={(e) => updateHint(qIdx, hIdx, e.target.value)}
                    className="admin-input"
                  />
                  <button onClick={() => removeHint(qIdx, hIdx)} className="remove-button-small">
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={() => addHint(qIdx)} className="add-button-small">
                + Add Hint
              </button>
            </div>
          </div>
        ))}

        <button onClick={addQuestion} className="add-button">
          + Add Question
        </button>

        <button onClick={createTemplate} disabled={busy || loading} className="admin-button">
          {busy ? 'Creating...' : 'Create Template'}
        </button>
      </div>

      <div className="templates-list">
        <h3>Existing Templates ({templates.length})</h3>
        {templates.map((template, idx) => (
          <div key={idx} className="template-card">
            {editingTemplate === template.template_id ? (
              <div className="edit-template-form" style={{ width: '100%' }}>
                <input
                  type="text"
                  placeholder="Template Title"
                  value={editTemplateForm.title}
                  onChange={(e) => setEditTemplateForm({ ...editTemplateForm, title: e.target.value })}
                  className="admin-input"
                  style={{ marginBottom: '0.5rem' }}
                />
                
                <textarea
                  placeholder="Template Description"
                  value={editTemplateForm.description}
                  onChange={(e) => setEditTemplateForm({ ...editTemplateForm, description: e.target.value })}
                  className="admin-textarea"
                  rows="2"
                  style={{ marginBottom: '1rem' }}
                />

                <h4 style={{ marginBottom: '0.5rem' }}>Questions</h4>
                {editTemplateForm.questions.map((question, qIdx) => (
                  <div key={qIdx} className="question-form" style={{ marginBottom: '1rem' }}>
                    <div className="question-header">
                      <h5>Question {qIdx + 1}</h5>
                      {editTemplateForm.questions.length > 1 && (
                        <button onClick={() => removeEditTemplateQuestion(qIdx)} className="remove-button-small">
                          Remove
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Question Number (e.g., 1 or 1.1)"
                      value={question.number}
                      onChange={(e) => updateEditTemplateQuestion(qIdx, 'number', e.target.value)}
                      className="admin-input"
                      style={{ marginBottom: '0.5rem' }}
                    />

                    <input
                      type="number"
                      placeholder="Marks"
                      min="0"
                      step="0.5"
                      value={question.marks}
                      onChange={(e) => updateEditTemplateQuestion(qIdx, 'marks', e.target.value)}
                      className="admin-input"
                      style={{ marginBottom: '0.5rem' }}
                    />
                    
                    <textarea
                      placeholder="Question text (Markdown supported)"
                      value={question.prompt_md}
                      onChange={(e) => updateEditTemplateQuestion(qIdx, 'prompt_md', e.target.value)}
                      className="admin-textarea"
                      rows="2"
                      style={{ marginBottom: '0.5rem' }}
                    />

                    <div className="hints-section">
                      <h6>Hints</h6>
                      {question.hints.map((hint, hIdx) => (
                        <div key={hIdx} className="hint-input-group">
                          <input
                            type="text"
                            placeholder={`Hint ${hIdx + 1}`}
                            value={hint}
                            onChange={(e) => updateEditTemplateHint(qIdx, hIdx, e.target.value)}
                            className="admin-input"
                          />
                          <button onClick={() => removeEditTemplateHint(qIdx, hIdx)} className="remove-button-small">
                            ✕
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addEditTemplateHint(qIdx)} className="add-button-small">
                        + Add Hint
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={addEditTemplateQuestion} className="add-button" style={{ marginBottom: '1rem' }}>
                  + Add Question
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={updateTemplate} 
                    disabled={busy || loading}
                    className="admin-button"
                    style={{ flex: 1 }}
                  >
                    {busy ? 'Updating...' : 'Save Changes'}
                  </button>
                  <button 
                    onClick={cancelEditTemplate}
                    className="cancel-button"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h4>{template.title}</h4>
                  <p>{template.description}</p>
                  <span className="template-meta">{template.questions?.length || 0} questions</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => startEditTemplate(template)}
                    className="edit-button"
                    disabled={busy || loading}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.template_id)}
                    className="remove-button"
                    disabled={busy || loading}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}