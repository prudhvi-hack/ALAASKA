import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import '../styles/assignments.css';
import AssignmentsList from './assignments/AssignmentsList';
import AssignmentDetail from './assignments/AssignmentDetail';

export default function AssignmentsPage({ 
  autoOpenAssignmentId = null, 
  autoScrollToQuestionId = null,
  onClearAutoOpen = null
}) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  // Auto-open assignment when navigating from chat
  useEffect(() => {
    if (autoOpenAssignmentId && assignments.length > 0 && !selectedAssignment) {
      const assignment = assignments.find(a => a.assignment_id === autoOpenAssignmentId);
      if (assignment) {
        loadAssignmentDetails(autoOpenAssignmentId);
      }
    }
  }, [autoOpenAssignmentId, assignments, selectedAssignment]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/assignments');
      setAssignments(res.data.assignments || res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      
      if (err.message === 'Session expired') {
        return;
      }
      
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignmentDetails = async (assignmentId) => {
    try {
      setLoadingDetails(true);
      const res = await api.get(`/assignments/${assignmentId}`);
      setSelectedAssignment(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load assignment details');
    } finally {
      setLoadingDetails(false);
    }
  };

    const refreshAssignmentDetails = async () => {
    if (selectedAssignment) {
      await loadAssignmentDetails(selectedAssignment.assignment_id);
      await loadAssignments(); // Also refresh list
    }
  };

  const handleBackToAssignments = () => {
    setSelectedAssignment(null);
    loadAssignments()
    
    if (onClearAutoOpen) {
      onClearAutoOpen();
    }
  };

  if (loading) {
    return (
      <div className="assignments-loading">
        <p>Loading assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assignments-error">
        <p>{error}</p>
        <button onClick={loadAssignments} className="retry-button">Retry</button>
      </div>
    );
  }

  if (selectedAssignment) {
    return (
      <AssignmentDetail
        assignment={selectedAssignment}
        loadingDetails={loadingDetails}
        onBack={handleBackToAssignments}
        autoScrollToQuestionId={autoScrollToQuestionId}
        onRefresh={refreshAssignmentDetails}
      />
    );
  }

  return (
    <div className="assignments-container">
      <div className="assignments-header">
        <h2>My Assignments</h2>
      </div>
      
      <AssignmentsList
        assignments={assignments}
        onLoadAssignmentDetails={loadAssignmentDetails}
        onRefresh={loadAssignments}
      />
    </div>
  );
}