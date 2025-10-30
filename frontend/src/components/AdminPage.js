import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/admin.css';

const BACKEND_URL = '';

function AdminPage({ getToken }) {
  const [activeTab, setActiveTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // Admin Management State
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Template Creation State
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    questions: [{ question_text: '', hints: [''] }]
  });

  // Assignment Creation State
  const [assignmentForm, setAssignmentForm] = useState({
    template_id: '',
    allowed_students: ['']
  });

  useEffect(() => {
    loadAdmins();
    loadTemplates();
    loadAssignments();
    loadUsers();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  // ========== ADMIN MANAGEMENT ==========
  const loadAdmins = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/admin/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdmins(res.data.admins);
    } catch (err) {
      console.error('Failed to load admins:', err);
      showNotification('Failed to load admins', 'error');
    }
  };

  const loadUsers = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      showNotification('Please enter an email', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      await axios.post(`${BACKEND_URL}/admin/add`, 
        { email: newAdminEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Admin added successfully', 'success');
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
      const token = await getToken();
      await axios.delete(`${BACKEND_URL}/admin/remove`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { email }
      });
      showNotification('Admin removed successfully', 'success');
      loadAdmins();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to remove admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ========== TEMPLATE MANAGEMENT ==========
  const loadTemplates = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/assignment-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const addQuestion = () => {
    setTemplateForm({
      ...templateForm,
      questions: [...templateForm.questions, { question_text: '', hints: [''] }]
    });
  };

  const removeQuestion = (index) => {
    const newQuestions = templateForm.questions.filter((_, i) => i !== index);
    setTemplateForm({ ...templateForm, questions: newQuestions });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...templateForm.questions];
    newQuestions[index][field] = value;
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

  const createTemplate = async () => {
    if (!templateForm.title.trim() || !templateForm.description.trim()) {
      showNotification('Please fill in title and description', 'error');
      return;
    }

    if (templateForm.questions.some(q => !q.question_text.trim())) {
      showNotification('All questions must have text', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      await axios.post(`${BACKEND_URL}/assignment-templates`, templateForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Template created successfully', 'success');
      setTemplateForm({
        title: '',
        description: '',
        questions: [{ question_text: '', hints: [''] }]
      });
      loadTemplates();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to create template', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ========== ASSIGNMENT MANAGEMENT ==========
  const loadAssignments = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/admin/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssignments(res.data.assignments || []);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    }
  };

  const addStudentEmail = () => {
    setAssignmentForm({
      ...assignmentForm,
      allowed_students: [...assignmentForm.allowed_students, '']
    });
  };

  const removeStudentEmail = (index) => {
    const newStudents = assignmentForm.allowed_students.filter((_, i) => i !== index);
    setAssignmentForm({ ...assignmentForm, allowed_students: newStudents });
  };

  const updateStudentEmail = (index, value) => {
    const newStudents = [...assignmentForm.allowed_students];
    newStudents[index] = value;
    setAssignmentForm({ ...assignmentForm, allowed_students: newStudents });
  };

  const createAssignment = async () => {
    if (!assignmentForm.template_id) {
      showNotification('Please select a template', 'error');
      return;
    }

    const validEmails = assignmentForm.allowed_students.filter(email => email.trim());
    if (validEmails.length === 0) {
      showNotification('Please add at least one student email', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      await axios.post(`${BACKEND_URL}/assignments`, 
        { ...assignmentForm, allowed_students: validEmails },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Assignment created successfully', 'success');
      setAssignmentForm({
        template_id: '',
        allowed_students: ['']
      });
      loadAssignments();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to create assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ========== RENDER ==========
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
        {/* ADMINS TAB */}
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
                  {admin.email !== 'gvp5349@psu.edu' && (
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

        {/* TEMPLATES TAB */}
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
                  
                  <textarea
                    placeholder="Question text"
                    value={question.question_text}
                    onChange={(e) => updateQuestion(qIdx, 'question_text', e.target.value)}
                    className="admin-textarea"
                    rows="2"
                  />

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
                  <h4>{template.title}</h4>
                  <p>{template.description}</p>
                  <span className="template-meta">{template.questions?.length || 0} questions</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
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
              {assignmentForm.allowed_students.map((email, idx) => (
                <div key={idx} className="student-email-group">
                  <input
                    type="email"
                    placeholder="Student email"
                    value={email}
                    onChange={(e) => updateStudentEmail(idx, e.target.value)}
                    className="admin-input"
                  />
                  {assignmentForm.allowed_students.length > 1 && (
                    <button onClick={() => removeStudentEmail(idx)} className="remove-button-small">
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button onClick={addStudentEmail} className="add-button-small">
                + Add Student
              </button>

              <button onClick={createAssignment} disabled={loading} className="admin-button">
                {loading ? 'Creating...' : 'Create Assignment'}
              </button>
            </div>

            <div className="assignments-list">
              <h3>Created Assignments ({assignments.length})</h3>
              {assignments.map((assignment, idx) => (
                <div key={idx} className="assignment-card-admin">
                  <h4>{assignment.title}</h4>
                  <p>{assignment.description}</p>
                  <span className="assignment-meta">
                    Assigned to {assignment.allowed_students?.length || 0} students
                  </span>
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