import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import '../styles/admin.css';

function AdminPage() {
  const [activeTab, setActiveTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editTemplateForm, setEditTemplateForm] = useState({
    title: '',
    description: '',
    questions: []
  });

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
      setLoading(true);
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
      loadTemplates();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update template';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/assignment-templates/${templateId}`);
      showNotification('Template deleted successfully');
      loadTemplates();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete template';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteAssignment = async (assignmentId, assignmentTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${assignmentTitle}"?\n\nThis will delete:\n- The assignment\n- All student progress\n- All chat conversations\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/assignments/${assignmentId}`);
      showNotification(`Assignment deleted. ${response.data.student_assignments_deleted} student assignment(s) removed.`);
      loadAssignments();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete assignment';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
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


  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    questions: [{ number: '', prompt_md: '', marks: 1, hints: [] }]
  });

  const [assignmentForm, setAssignmentForm] = useState({
    template_id: '',
    student_emails_text: '' // ✅ Changed to textarea input
  });

  // ✅ NEW: State for editing assignments
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editForm, setEditForm] = useState({
    assignment_id: '',
    student_emails_text: ''
  });

  useEffect(() => {
    loadAdmins();
    loadTemplates();
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadAdmins = async () => {
    try {
      const res = await api.get('/admin/list');
      setAdmins(res.data.admins);
    } catch (err) {
      if (err.message === 'Session expired') return;
      console.error('Failed to load admins:', err);
      showNotification('Failed to load admins', 'error');
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await api.get('/assignment-templates');
      setTemplates(res.data.templates || []);
    } catch (err) {
      if (err.message === 'Session expired') return;
      console.error('Failed to load templates:', err);
    }
  };

  const loadAssignments = async () => {
    try {
      const res = await api.get('/admin/assignments');
      setAssignments(res.data.assignments || []);
    } catch (err) {
      if (err.message === 'Session expired') return;
      console.error('Failed to load assignments:', err);
    }
  };
  // Add this function after loadAssignments

  const exportAssignmentPDF = async (assignmentId, assignmentTitle) => {
    try {
      setLoading(true);
      showNotification('Generating PDF... This may take a moment', 'info');
      
      const response = await api.post(
        `/assignments/${assignmentId}/export-pdf`,
        {},
        {
          responseType: 'blob' // Important: Tell axios to expect binary data
        }
      );
      
      // Create a blob from the PDF stream
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const safeTitle = assignmentTitle.replace(/[^a-zA-Z0-9-_ ]/g, '_');
      link.download = `${safeTitle}_submissions.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showNotification('PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showNotification(err.response?.data?.detail || 'Failed to export PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      showNotification('Please enter an email', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.post('/admin/add', { email: newAdminEmail });
      showNotification('Admin added successfully');
      setNewAdminEmail('');
      loadAdmins();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to add admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeAdmin = async (email) => {
    if (!window.confirm(`Remove admin privileges from ${email}?`)) return;

    try {
      setLoading(true);
      await api.delete('/admin/remove', { data: { email } });
      showNotification('Admin removed successfully');
      loadAdmins();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to remove admin', 'error');
    } finally {
      setLoading(false);
    }
  };

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
      setLoading(true);
      const payload = {
        title: templateForm.title,
        description: templateForm.description,
        questions: templateForm.questions.map(q => ({
          number: q.number.trim(),
          prompt_md: q.prompt_md,
          marks: parseFloat(q.marks),
          hints: q.hints.filter(h => h && h.trim() !== '') // ✅ Filter empty hints
        }))
      };

      await api.post('/assignment-templates', payload);
      showNotification('Template created successfully');
      setTemplateForm({
        title: '',
        description: '',
        questions: [{ number: '', prompt_md: '', marks: 1, hints: [] }] // ✅ Start with empty hints
      });
      loadTemplates();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to create template';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Parse emails from textarea
  const parseEmails = (text) => {
    return text
      .split('\n')
      .map(email => email.trim())
      .filter(email => email.length > 0);
  };

  // ✅ NEW: Count valid emails
  const countValidEmails = (text) => {
    const emails = parseEmails(text);
    return emails.filter(email => email.includes('@')).length;
  };

  const createAssignment = async () => {
    if (!assignmentForm.template_id) {
      showNotification('Please select a template', 'error');
      return;
    }

    const validEmails = parseEmails(assignmentForm.student_emails_text);
    if (validEmails.length === 0) {
      showNotification('Please add at least one student email', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.post('/assignments', { 
        template_id: assignmentForm.template_id,
        allowed_students: validEmails
      });
      showNotification(`Assignment created for ${validEmails.length} student(s)`);
      setAssignmentForm({
        template_id: '',
        student_emails_text: ''
      });
      loadAssignments();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to create assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Start editing assignment
  const startEditAssignment = (assignment) => {
    setEditingAssignment(assignment.assignment_id);
    setEditForm({
      assignment_id: assignment.assignment_id,
      student_emails_text: assignment.allowed_students?.join('\n') || ''
    });
  };

  // ✅ NEW: Cancel editing
  const cancelEdit = () => {
    setEditingAssignment(null);
    setEditForm({ assignment_id: '', student_emails_text: '' });
  };

  // ✅ NEW: Update assignment with new students
  const updateAssignment = async () => {
    const validEmails = parseEmails(editForm.student_emails_text);
    if (validEmails.length === 0) {
      showNotification('Please add at least one student email', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/assignments/${editForm.assignment_id}/students`, {
        allowed_students: validEmails
      });
      showNotification('Assignment updated successfully');
      cancelEdit();
      loadAssignments();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      {notification.show && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="admin-header">
        <h1>Admin Panel</h1>
        <div className="admin-tabs">
          <button
            className={activeTab === 'admins' ? 'tab-active' : ''}
            onClick={() => setActiveTab('admins')}
          >
            Manage Admins
          </button>
          <button
            className={activeTab === 'templates' ? 'tab-active' : ''}
            onClick={() => setActiveTab('templates')}
          >
            Create Templates
          </button>
          <button
            className={activeTab === 'assignments' ? 'tab-active' : ''}
            onClick={() => setActiveTab('assignments')}
          >
            Create Assignments
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'admins' && (
          <div className="admin-section">
            <h2>Manage Admins</h2>
            
            <div className="add-admin-form">
              <input
                type="email"
                placeholder="Enter email address"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="admin-input"
              />
              <button onClick={addAdmin} disabled={loading} className="admin-button">
                {loading ? 'Adding...' : 'Add Admin'}
              </button>
            </div>

            <div className="admins-list">
              <h3>Current Admins ({admins.length})</h3>
              {admins.map((admin, idx) => (
                <div key={idx} className="admin-card">
                  <div className="admin-info">
                    <span className="admin-email">{admin.email}</span>
                    <span className="admin-meta">
                      Added: {admin.added_at}
                      {admin.added_by && admin.added_by !== 'N/A' && ` by ${admin.added_by}`}
                    </span>
                  </div>
                  {(
                    <button
                      onClick={() => removeAdmin(admin.email)}
                      className="remove-button"
                      disabled={loading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
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

              <button onClick={createTemplate} disabled={loading} className="admin-button">
                {loading ? 'Creating...' : 'Create Template'}
              </button>
            </div>

            <div className="templates-list">
              <h3>Existing Templates ({templates.length})</h3>
              {templates.map((template, idx) => (
                <div key={idx} className="template-card">
                  {editingTemplate === template.template_id ? (
                    // ✅ Edit mode
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
                          disabled={loading}
                          className="admin-button"
                          style={{ flex: 1 }}
                        >
                          {loading ? 'Updating...' : 'Save Changes'}
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
                    // ✅ View mode
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
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.template_id)}
                          className="remove-button"
                          disabled={loading}
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
        )}

        {activeTab === 'assignments' && (
          <div className="admin-section">
            <h2>Create Assignment</h2>
            
            <div className="assignment-form">
              <select
                value={assignmentForm.template_id}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, template_id: e.target.value })}
                className="admin-select"
              >
                <option value="">Select a template</option>
                {templates.map((template, idx) => (
                  <option key={idx} value={template.template_id}>
                    {template.title}
                  </option>
                ))}
              </select>

              <h3>Assign to Students</h3>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Enter student emails, one per line
              </p>
              <textarea
                placeholder="student1@example.com&#10;student2@example.com&#10;student3@example.com"
                value={assignmentForm.student_emails_text}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, student_emails_text: e.target.value })}
                className="admin-textarea"
                rows="8"
                style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
              />

              <button 
                onClick={createAssignment} 
                disabled={loading || !assignmentForm.template_id || countValidEmails(assignmentForm.student_emails_text) === 0} 
                className="admin-button"
              >
                {loading ? 'Creating...' : `Add ${countValidEmails(assignmentForm.student_emails_text)} Student(s)`}
              </button>
            </div>

            <div className="assignments-list">
              <h3>Created Assignments ({assignments.length})</h3>
              {assignments.map((assignment, idx) => (
                <div 
                  key={idx} 
                  className={`assignment-card-admin ${editingAssignment === assignment.assignment_id ? 'edit-mode' : 'view-mode'}`}
                >
                  {editingAssignment === assignment.assignment_id ? (
                    // ✅ Edit mode
                    <div className="edit-assignment-form">
                      <h4>{assignment.title}</h4>
                      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        Edit student emails (one per line)
                      </p>
                      <textarea
                        value={editForm.student_emails_text}
                        onChange={(e) => setEditForm({ ...editForm, student_emails_text: e.target.value })}
                        className="admin-textarea"
                        rows="6"
                        style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                      />
                      <div className="button-group">
                        <button 
                          onClick={updateAssignment} 
                          disabled={loading}
                          className="admin-button"
                          style={{ flex: 1 }}
                        >
                          {loading ? 'Updating...' : `Update (${countValidEmails(editForm.student_emails_text)} students)`}
                        </button>
                        <button 
                          onClick={cancelEdit}
                          className="cancel-button"
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ✅ View mode
                    <>
                      <div className="assignment-card-content">
                        <h4>{assignment.title}</h4>
                        
                        <p className={`assignment-description ${expandedDescriptions[assignment.assignment_id] ? 'expanded' : 'truncated'}`}>
                          {assignment.description}
                        </p>
                        
                        {assignment.description && assignment.description.length > 100 && (
                          <button 
                            className="see-more-button"
                            onClick={() => setExpandedDescriptions(prev => ({ 
                              ...prev, 
                              [assignment.assignment_id]: !prev[assignment.assignment_id] 
                            }))}
                          >
                            {expandedDescriptions[assignment.assignment_id] ? 'See less' : 'See more'}
                          </button>
                        )}
                        
                        <span className="assignment-meta" style={{ display: 'block', marginTop: '0.5rem' }}>
                          Assigned to {assignment.allowed_students?.length || 0} student(s)
                        </span>
                      </div>
                      
                      <div className="assignment-card-actions">
                        <button
                          onClick={() => startEditAssignment(assignment)}
                          className="edit-button"
                        >
                          Edit Students
                        </button>
                        
                        <button
                          onClick={() => exportAssignmentPDF(assignment.assignment_id, assignment.title)}
                          disabled={loading}
                          className="export-pdf-button"
                        >
                          📄 Export PDF
                        </button>

                        <button
                          onClick={() => deleteAssignment(assignment.assignment_id, assignment.title)}
                          disabled={loading}
                          className="remove-button"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;