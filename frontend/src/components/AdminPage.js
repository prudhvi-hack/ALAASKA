import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import '../styles/admin.css';

// Import sub-components
import AdminTabs from './admin/AdminTabs';
import ManageAdmins from './admin/ManageAdmins';
import ManageGraders from './admin/ManageGraders';
import QuizTemplates from './admin/QuizTemplates';
import AssignmentTemplates from './admin/AssignmentTemplates';
import CreateAssignments from './admin/CreateAssignments';

function AdminPage() {
  const [activeTab, setActiveTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [graders, setGraders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quizTemplates, setQuizTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    loadAdmins();
    loadGraders();
    loadTemplates();
    loadAssignments();
    loadQuizTemplates();
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
    }
  };

  const loadGraders = async () => {
    try {
      const res = await api.get('/admin/graders');
      setGraders(res.data.graders);
    } catch (err) {
      if (err.message === 'Session expired') return;
      console.error('Failed to load graders:', err);
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

  const loadQuizTemplates = async () => {
    try {
      const res = await api.get('/quiz-templates');
      setQuizTemplates(res.data.quizzes || []);
    } catch (err) {
      if (err.message === 'Session expired') return;
      console.error('Failed to load quiz templates:', err);
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
        <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <div className="admin-content">
        {activeTab === 'admins' && (
          <ManageAdmins
            admins={admins}
            loading={loading}
            onUpdate={loadAdmins}
            showNotification={showNotification}
          />
        )}

        {activeTab === 'graders' && (
          <ManageGraders
            graders={graders}
            loading={loading}
            onUpdate={loadGraders}
            showNotification={showNotification}
          />
        )}

        {activeTab === 'quizzes' && (
          <QuizTemplates
            quizTemplates={quizTemplates}
            loading={loading}
            onUpdate={loadQuizTemplates}
            showNotification={showNotification}
          />
        )}

        {activeTab === 'templates' && (
          <AssignmentTemplates
            templates={templates}
            loading={loading}
            onUpdate={loadTemplates}
            showNotification={showNotification}
          />
        )}

        {activeTab === 'assignments' && (
          <CreateAssignments
            templates={templates}
            quizTemplates={quizTemplates}
            assignments={assignments}
            loading={loading}
            onUpdate={loadAssignments}
            showNotification={showNotification}
          />
        )}
      </div>
    </div>
  );
}

export default AdminPage;