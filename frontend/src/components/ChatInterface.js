import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function ChatInterface({ messages, input, setInput, sendMessage }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="main">
      <div className="chatbox">
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
            messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.isStreaming && !msg.content ? (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

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
            Send
          </button>
        </div>
      </div>
    </div>
  );
}