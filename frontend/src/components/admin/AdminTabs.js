import React from 'react';

export default function AdminTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'admins', label: 'Manage Admins' },
    { id: 'graders', label: 'Manage Graders' },
    { id: 'quizzes', label: 'Quiz Templates' },
    { id: 'templates', label: 'Assignment Templates' },
    { id: 'assignments', label: 'Create Assignments' }
  ];

  return (
    <div className="admin-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? 'tab-active' : ''}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}