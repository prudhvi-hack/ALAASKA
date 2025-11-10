import React, { useState } from 'react';
import api from '../../api/axios';

export default function ManageGraders({ graders, loading, onUpdate, showNotification }) {
  const [newGraderEmail, setNewGraderEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const addGrader = async () => {
    if (!newGraderEmail.trim()) {
      showNotification('Please enter an email', 'error');
      return;
    }

    try {
      setBusy(true);
      await api.post('/admin/graders/add', { email: newGraderEmail });
      showNotification('Grader added successfully');
      setNewGraderEmail('');
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to add grader', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeGrader = async (email) => {
    if (!window.confirm(`Remove grader privileges from ${email}?`)) return;

    try {
      setBusy(true);
      await api.delete('/admin/graders/remove', { data: { email } });
      showNotification('Grader removed successfully');
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to remove grader', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-section">
      <h2>Manage Graders</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Graders can view all student chats and submissions but cannot modify assignments or admin settings.
      </p>
      
      <div className="add-admin-form">
        <input
          type="email"
          placeholder="Enter email address"
          value={newGraderEmail}
          onChange={(e) => setNewGraderEmail(e.target.value)}
          className="admin-input"
        />
        <button onClick={addGrader} disabled={busy || loading} className="admin-button">
          {busy ? 'Adding...' : 'Add Grader'}
        </button>
      </div>

      <div className="admins-list">
        <h3>Current Graders ({graders.length})</h3>
        {graders.map((grader, idx) => (
          <div key={idx} className="admin-card">
            <div className="admin-info">
              <span className="admin-email">
                {grader.email}
                {grader.is_admin && (
                  <span className="badge" style={{ 
                    marginLeft: '0.5rem',
                    background: '#3498db',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    Also Admin
                  </span>
                )}
              </span>
              <span className="admin-meta">
                Added: {grader.added_at}
                {grader.added_by && grader.added_by !== 'N/A' && ` by ${grader.added_by}`}
              </span>
            </div>
            <button
              onClick={() => removeGrader(grader.email)}
              className="remove-button"
              disabled={busy || loading}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}