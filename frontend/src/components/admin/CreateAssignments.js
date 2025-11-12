import React, { useState } from 'react';
import api from '../../api/axios';

export default function CreateAssignments({ templates, quizTemplates, assignments, loading, onUpdate, showNotification }) {
  const [busy, setBusy] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(null);
  const [submissionSettings, setSubmissionSettings] = useState({
    submissions_enabled: true,
    submission_exceptions: ''
  });

  const [assignmentForm, setAssignmentForm] = useState({
    template_id: '',
    student_emails_text: '',
    pre_quiz_id: '',
    post_quiz_id: ''
  });

  const [editForm, setEditForm] = useState({
    assignment_id: '',
    student_emails_text: ''
  });

  const parseEmails = (text) => {
    return text
      .split('\n')
      .map(email => email.trim())
      .filter(email => email.length > 0);
  };

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
      setBusy(true);
      await api.post('/assignments', { 
        template_id: assignmentForm.template_id,
        allowed_students: validEmails,
        pre_quiz_id: assignmentForm.pre_quiz_id || null,
        post_quiz_id: assignmentForm.post_quiz_id || null
      });
      showNotification(`Assignment created for ${validEmails.length} student(s)`);
      setAssignmentForm({
        template_id: '',
        student_emails_text: '',
        pre_quiz_id: '',
        post_quiz_id: ''
      });
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to create assignment', 'error');
    } finally {
      setBusy(false);
    }
  };

  const startEditAssignment = (assignment) => {
    setEditingAssignment(assignment.assignment_id);
    setEditForm({
      assignment_id: assignment.assignment_id,
      student_emails_text: assignment.allowed_students?.join('\n') || ''
    });
  };

  const cancelEdit = () => {
    setEditingAssignment(null);
    setEditForm({ assignment_id: '', student_emails_text: '' });
  };

  const updateAssignment = async () => {
    const validEmails = parseEmails(editForm.student_emails_text);
    if (validEmails.length === 0) {
      showNotification('Please add at least one student email', 'error');
      return;
    }

    try {
      setBusy(true);
      await api.put(`/assignments/${editForm.assignment_id}/students`, {
        allowed_students: validEmails
      });
      showNotification('Assignment updated successfully');
      cancelEdit();
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update assignment', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteAssignment = async (assignmentId, assignmentTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${assignmentTitle}"?\n\nThis will delete:\n- The assignment\n- All student progress\n- All chat conversations\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      setBusy(true);
      const response = await api.delete(`/assignments/${assignmentId}`);
      showNotification(`Assignment deleted. ${response.data.student_assignments_deleted} student assignment(s) removed.`);
      onUpdate();
      window.location.reload();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete assignment';
      showNotification(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportAssignmentPDF = async (assignmentId, assignmentTitle) => {
    try {
      setBusy(true);
      showNotification('Generating PDF... This may take a moment', 'info');
      
      const response = await api.post(
        `/assignments/${assignmentId}/export-pdf`,
        {},
        {
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const safeTitle = assignmentTitle.replace(/[^a-zA-Z0-9-_ ]/g, '_');
      link.download = `${safeTitle}_submissions.pdf`;
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showNotification('PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showNotification(err.response?.data?.detail || 'Failed to export PDF', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openSubmissionSettings = async (assignmentId) => {
  try {
    const res = await api.get(`/assignments/${assignmentId}/submission-settings`);
    setSubmissionSettings({
      submissions_enabled: res.data.submissions_enabled,
      submission_exceptions: res.data.submission_exceptions.join('\n')
    });
    setShowSubmissionModal(assignmentId);
  } catch (err) {
    showNotification('Failed to load submission settings', 'error');
  }
};

const saveSubmissionSettings = async () => {
  const emails = submissionSettings.submission_exceptions
    .split('\n')
    .map(e => e.trim())
    .filter(e => e.length > 0);

  try {
    setBusy(true);
    await api.put(`/assignments/${showSubmissionModal}/submission-settings`, {
      submissions_enabled: submissionSettings.submissions_enabled,
      submission_exceptions: emails
    });
    showNotification('Submission settings updated successfully');
    setShowSubmissionModal(null);
    onUpdate();
  } catch (err) {
    showNotification(err.response?.data?.detail || 'Failed to update settings', 'error');
  } finally {
    setBusy(false);
  }
};

  return (
    <div className="admin-section">
      <h2>Create Assignment</h2>
      
      <div className="assignment-form">
        <select
          value={assignmentForm.template_id}
          onChange={(e) => setAssignmentForm({ ...assignmentForm, template_id: e.target.value })}
          className="admin-select"
        >
          <option value="">Select an assignment template</option>
          {templates.map((template, idx) => (
            <option key={idx} value={template.template_id}>
              {template.title}
            </option>
          ))}
        </select>

        <div style={{ marginTop: '1rem' }}>
          <h3>Pre-Quiz (Optional)</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Students must complete this quiz before accepting the assignment
          </p>
          <select
            value={assignmentForm.pre_quiz_id}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, pre_quiz_id: e.target.value })}
            className="admin-select"
          >
            <option value="">No pre-quiz</option>
            {quizTemplates.map((quiz, idx) => (
              <option key={idx} value={quiz.quiz_id}>
                {quiz.title} ({quiz.questions?.length || 0} questions)
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <h3>Post-Quiz (Optional)</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Students must complete this quiz after finishing all questions
          </p>
          <select
            value={assignmentForm.post_quiz_id}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, post_quiz_id: e.target.value })}
            className="admin-select"
          >
            <option value="">No post-quiz</option>
            {quizTemplates.map((quiz, idx) => (
              <option key={idx} value={quiz.quiz_id}>
                {quiz.title} ({quiz.questions?.length || 0} questions)
              </option>
            ))}
          </select>
        </div>

        <h3 style={{ marginTop: '1.5rem' }}>Assign to Students</h3>
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
          disabled={busy || loading || !assignmentForm.template_id || countValidEmails(assignmentForm.student_emails_text) === 0} 
          className="admin-button"
        >
          {busy ? 'Creating...' : `Create Assignment for ${countValidEmails(assignmentForm.student_emails_text)} Student(s)`}
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
                    disabled={busy || loading}
                    className="admin-button"
                    style={{ flex: 1 }}
                  >
                    {busy ? 'Updating...' : `Update (${countValidEmails(editForm.student_emails_text)} students)`}
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
                    onClick={() => openSubmissionSettings(assignment.assignment_id)}
                    className="edit-button"
                    style={{ marginLeft: '0.5rem' }}
                  >
                    ⚙️ Submission Settings
                  </button>
                  
                  <button
                    onClick={() => exportAssignmentPDF(assignment.assignment_id, assignment.title)}
                    disabled={busy || loading}
                    className="export-pdf-button"
                  >
                    📄 Export PDF
                  </button>

                  <button
                    onClick={() => deleteAssignment(assignment.assignment_id, assignment.title)}
                    disabled={busy || loading}
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
      {showSubmissionModal && (
        <div className="modal-overlay" onClick={() => setShowSubmissionModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>Submission Settings</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={submissionSettings.submissions_enabled}
                  onChange={(e) => setSubmissionSettings({
                    ...submissionSettings,
                    submissions_enabled: e.target.checked
                  })}
                />
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  Enable submissions globally
                </span>
              </label>
              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem', marginLeft: '1.7rem' }}>
                When disabled, only students in the exceptions list can submit
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Allow specific students when submissions are disabled:
              </label>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Enter emails (one per line) for students who can submit even when disabled
              </p>
              <textarea
                value={submissionSettings.submission_exceptions}
                onChange={(e) => setSubmissionSettings({
                  ...submissionSettings,
                  submission_exceptions: e.target.value
                })}
                placeholder="student1@example.com&#10;student2@example.com"
                rows="6"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                onClick={saveSubmissionSettings}
                disabled={busy}
                className="admin-button"
                style={{ flex: 1 }}
              >
                {busy ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setShowSubmissionModal(null)}
                className="cancel-button"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
}