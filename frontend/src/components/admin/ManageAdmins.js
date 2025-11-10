import React, { useState } from 'react';
import api from '../../api/axios';

export default function ManageAdmins({ admins, loading, onUpdate, showNotification }) {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      showNotification('Please enter an email', 'error');
      return;
    }

    try {
      setBusy(true);
      await api.post('/admin/add', { email: newAdminEmail });
      showNotification('Admin added successfully');
      setNewAdminEmail('');
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to add admin', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeAdmin = async (email) => {
    if (!window.confirm(`Remove admin privileges from ${email}?`)) return;

    try {
      setBusy(true);
      await api.delete('/admin/remove', { data: { email } });
      showNotification('Admin removed successfully');
      onUpdate();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to remove admin', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
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
        <button onClick={addAdmin} disabled={busy || loading} className="admin-button">
          {busy ? 'Adding...' : 'Add Admin'}
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
            <button
              onClick={() => removeAdmin(admin.email)}
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