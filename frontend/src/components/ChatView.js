import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import logo from "../assets/alaaska_logo.png";

export default function ChatView({
  messages,
  typingText,
  isLoading,
  sendMessage,
  userInput,
  setUserInput,
  inputRef,
  messagesEndRef,
}) {
  return (
    <div className="container">
      <div className="main">
        <div className="chatbox">
          <div className="messages">
            <div className="messages-inner">
              {messages
                .filter((msg) => msg.role !== "system")
                .map((msg, i) => (
                  <div key={i} className={`message ${msg.role === "user" ? "user-message" : "assistant-message"}`}>
                    {msg.role === "assistant" ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content || "")) }} />
                    ) : (
                      msg.content
                    )}
                  </div>
                ))}
              {typingText ? (
                <div className="message assistant-message">
                  <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(typingText)) }} />
                </div>
              ) : (
                isLoading && (
                  <div className="message assistant-message">
                    <div className="typing-indicator-with-logo">
                      <img src={logo} alt="Alaaska Logo" className="spinning-logo" />
                      <span className="typing-text">typing...</span>
                    </div>
                  </div>
                )
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="input-container">
            <textarea
              ref={inputRef}
              placeholder="Ask something..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={3}
              maxLength={1000}
              aria-label="Type your message"
            />
            <button className="send-button" onClick={sendMessage} title="Send" aria-label="Send message">
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}