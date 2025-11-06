import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../api/axios';

const BACKEND_URL = process.env.REACT_APP_API_URL || '';

function AssignmentChat({ chat, getToken, onClose, onReset }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (chat?.chat_id) {
      loadMessages();
    }
  }, [chat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const res = await api.get(`/conversation/${chat.chat_id}`);
      const filtered = (Array.isArray(res.data) ? res.data : []).filter(
        (m) => m.role !== 'system'
      );
      setMessages(filtered);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chat', {
        message: userMessage,
        chat_id: chat.chat_id,
      });

      if (res.data.messages) {
        const filtered = res.data.messages.filter((m) => m.role !== 'system');
        setMessages(filtered);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsAnswer = async (messageIndex, messageContent) => {
    if (!window.confirm('Mark this message as your final answer? This will replace any previous submission.')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(
        `/assignments/${chat.assignment_id}/questions/${chat.question_id}/submit-answer`,
        {
          chat_id: chat.chat_id,  // Include which chat
          message_index: messageIndex,
          message_content: messageContent
        }
      );

      alert(`✅ Answer submitted successfully!\nAttempt #${res.data.attempts}\nYou can view it in the Assignments page.`);
    } catch (err) {
      console.error('Failed to submit answer:', err);
      alert(err.response?.data?.detail || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (!chat) {
    return (
      <div className="assignment-chat-container">
        <p>No chat selected</p>
      </div>
    );
  }

  return (
    <div className="assignment-chat-container">
      <div className="assignment-chat-header">
        <div className="chat-header-info">
          <h3>{chat.summary || 'Assignment Question'}</h3>
          <span className="chat-subtitle">Question Chat</span>
        </div>
        <div className="chat-header-actions">
          {onReset && (
            <button onClick={onReset} className="reset-chat-btn" title="Start new chat">
              🔄 New Chat
            </button>
          )}
          <button onClick={onClose} className="close-chat-btn" title="Close chat">
            ✕
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
            
            {/* Show "Mark as Final Answer" button only for user messages */}
            {msg.role === 'user' && (
              <button
                onClick={() => handleMarkAsAnswer(idx, msg.content)}
                className="mark-answer-btn"
                disabled={submitting}
                title="Submit this as your final answer"
              >
                {submitting ? '⏳ Submitting...' : '📌 Mark as Final Answer'}
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-content">
              <em>ALAASKA is thinking...</em>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          className="chat-input"
        />
        <button type="submit" disabled={loading || !input.trim()} className="send-btn">
          Send
        </button>
      </form>
    </div>
  );
}

export default AssignmentChat;