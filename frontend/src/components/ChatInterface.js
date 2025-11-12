import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import api from '../api/axios';
import LatexEditor from './LatexEditor';
import '../styles/assignment_chat.css';

export default function ChatInterface({ chatId, messages, input, setInput, sendMessage, onNavigateToAssignment }) {
  const [metadata, setMetadata] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [useLatexEditor, setUseLatexEditor] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (chatId) {
      loadChatMetadata();
    }
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatMetadata = async () => {
    try {
      const res = await api.get(`/conversation/${chatId}`);
      const meta = res.data.metadata;
      setMetadata(meta);

      if (meta?.is_assignment_chat && meta?.assignment_id) {
        try {
          const assignmentRes = await api.get(`/assignments/${meta.assignment_id}`);
          setMetadata(prev => ({
            ...prev,
            assignment_title: assignmentRes.data.title
          }));
        } catch (err) {
          console.error('Failed to load assignment title:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load chat metadata:', err);
    }
  };

  const handleMarkAsAnswer = async (messageContent) => {
    if (!metadata?.is_assignment_chat) return;
    
    if (metadata?.submissions_disabled) {
      alert('Submissions are currently disabled for this assignment.');
      return;
    }

    if (!window.confirm('Mark this message as your final answer? This will replace any previous submission.')) {
      return;
    }

    setSubmitting(true);
    setActiveMenu(null);
    
    try {
      const res = await api.post(
        `/assignments/${metadata.assignment_id}/questions/${metadata.question_id}/submit-answer`,
        {
          chat_id: chatId,
          message_index: 0,
          message_content: messageContent
        }
      );

      alert(`Answer submitted successfully!\nAttempt #${res.data.attempts}\nYou can view it in the Assignments page.`);
      loadChatMetadata();
    } catch (err) {
      console.error('Failed to submit answer:', err);
      alert(err.response?.data?.detail || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNavigateToAssignment = () => {
    if (metadata?.assignment_id && metadata?.question_id) {
      onNavigateToAssignment(metadata.assignment_id, metadata.question_id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const preprocessLatex = (text) => {
    if (!text) return text;
    
    let processed = text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
    
    return processed;
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  return (
    <div className="main">
      <div className="chatbox">
        {metadata?.is_assignment_chat && (
          <div 
            className="assignment-chat-banner clickable"
            onClick={handleNavigateToAssignment}
            style={{ cursor: 'pointer' }}
            title="Click to view assignment"
          >
            <span className="banner-icon">📚</span>
            <div className="banner-info">
              <div className="banner-title">
                Q {metadata.question_number} of {metadata.assignment_title || 'Assignment'}
                {metadata.has_submitted && (
                  <span className="banner-submitted-badge">
                    ✓ Submitted (Attempt #{metadata.attempts})
                  </span>
                )}
                {metadata.is_grader_view && (
                  <span className="banner-grader-badge" style={{
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    background: '#ffc107',
                    color: '#000',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    👁️ GRADER VIEW
                  </span>
                )}
              </div>
              <div className="banner-subtitle" style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
                Click to view assignment details →
              </div>
            </div>
          </div>
        )}

        <div className="messages">
          {messages.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#888', 
              padding: '2rem',
              fontSize: '1.1rem'
            }}>
              <p>👋 Hi! I'm ALAASKA, your AI teaching assistant.</p>
              <p>Ask me anything about your studies!</p>
            </div>
          ) : (
            <div className="messages-inner">
              {messages
                .filter(msg => msg.role !== 'system')
                .map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={msg.role === 'user' ? 'user-message' : 'assistant-message'}
                  >
                    <div className="message-wrapper">
                      <div className="message-content-wrapper">
                        {msg.isStreaming && !msg.content ? (
                          <div className="typing-indicator">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                          </div>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {preprocessLatex(msg.content)}
                          </ReactMarkdown>
                        )}
                      </div>

                      {msg.role === 'user' && metadata?.is_assignment_chat && !msg.isStreaming && (
                        <div className="message-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === idx ? null : idx);
                            }}
                            disabled={submitting}
                            className={`message-menu-button ${activeMenu === idx ? 'active' : ''}`}
                            title="Options"
                          >
                            ⋮
                          </button>

                          {activeMenu === idx && (
                            <div
                              className="message-dropdown"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleMarkAsAnswer(msg.content)}
                                disabled={submitting}
                                className="dropdown-item"
                              >
                                <span className="dropdown-icon">📌</span>
                                {submitting ? 'Submitting...' : 'Mark as Final Answer'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ✅ UPDATED: Input Area with Left-Side Toggle */}
        <div className="input-area-wrapper">
          {useLatexEditor ? (
            <div className="latex-editor-container">
              <LatexEditor
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSubmit={sendMessage}
                placeholder="Type your answer using Markdown and LaTeX..."
              />
              <div className="latex-submit-bar">
                <button 
                  onClick={() => setUseLatexEditor(false)}
                  className="latex-toggle-button-left"
                  title="Switch to Simple Editor"
                >
                  📝
                </button>
                <button 
                  onClick={sendMessage}
                  className="latex-send-button"
                  disabled={!input.trim()}
                >
                  Send Message (Ctrl+Enter)
                </button>
              </div>
            </div>
          ) : (
            <div className="input-container-with-toggle">
              <button
                onClick={() => setUseLatexEditor(true)}
                className="toggle-latex-button-left"
                title="Switch to LaTeX Editor for Type Theory & Formal Verification"
              >
                🔬
              </button>
              <div className="input-container">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message here... (Shift+Enter for new line)"
                  rows="3"
                />
                <button 
                  onClick={sendMessage} 
                  className="send-button"
                  disabled={!input.trim()}
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}