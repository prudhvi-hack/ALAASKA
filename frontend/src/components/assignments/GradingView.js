import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import StudentSubmissionDetail from './StudentSubmissionDetail';

export default function GradingView({ assignmentId, assignmentTitle, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [assignmentInfo, setAssignmentInfo] = useState(null);

  useEffect(() => {
    loadSubmissions();
  }, [assignmentId]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/assignments/${assignmentId}/submissions`);
      setSubmissions(response.data.submissions || []);
      setAssignmentInfo(response.data.assignment);
    } catch (err) {
      console.error('Error loading submissions:', err);
      setError(err.response?.data?.detail || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (studentEmail) => {
    setSelectedStudent(studentEmail);
  };

  const handleBackToList = () => {
    setSelectedStudent(null);
    loadSubmissions(); // Refresh in case any grades were updated
  };

  // Filter submissions based on search
  const filteredSubmissions = submissions.filter(sub => 
    sub.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.student_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If viewing a specific student's submission
  if (selectedStudent) {
    return (
      <StudentSubmissionDetail
        assignmentId={assignmentId}
        studentEmail={selectedStudent}
        onBack={handleBackToList}
      />
    );
  }

  // Main grading view
  return (
    <div className="grading-view">
      <div className="grading-header">
        <button onClick={onBack} className="back-button">
          ← Back to Assignments
        </button>
        <h2>Grade: {assignmentTitle}</h2>
        {assignmentInfo && (
          <p className="assignment-meta">
            {assignmentInfo.total_questions} question(s)
            {assignmentInfo.due_date && ` • Due: ${new Date(assignmentInfo.due_date).toLocaleDateString()}`}
          </p>
        )}
      </div>

      <div className="grading-controls">
        <input
          type="text"
          placeholder="Search by student name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <div className="submission-stats">
          <span>Total: {submissions.length}</span>
          <span>Submitted: {submissions.filter(s => s.submitted).length}</span>
          <span>Pending: {submissions.filter(s => !s.submitted).length}</span>
        </div>
      </div>

      {loading && (
        <div className="loading-spinner">
          <p>Loading submissions...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadSubmissions}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="submissions-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                    {searchQuery ? 'No students match your search' : 'No submissions yet'}
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((submission) => (
                  <tr key={submission.student_email}>
                    <td className="student-name">{submission.student_name}</td>
                    <td className="student-email">{submission.student_email}</td>
                    <td>
                      {submission.submitted ? (
                        <span className="status-badge submitted">✓ Submitted</span>
                      ) : submission.accepted ? (
                        <span className="status-badge in-progress">In Progress</span>
                      ) : (
                        <span className="status-badge not-started">Not Accepted</span>
                      )}
                    </td>
                    <td className="timestamp-cell">
                      {submission.submitted_at ? (
                        new Date(submission.submitted_at).toLocaleString()
                      ) : submission.latest_answer_time ? (
                        <span style={{ color: '#999', fontSize: '0.9em' }}>
                          Last activity: {new Date(submission.latest_answer_time).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: '#ccc' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleStudentClick(submission.student_email)}
                        className="view-submission-button"
                      >
                        View Submission
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
