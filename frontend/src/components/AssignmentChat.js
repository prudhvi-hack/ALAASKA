import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "../styles/assignments.css";

const BACKEND_URL = process.env.REACT_APP_API_URL || '';

function AssignmentChat({ chat, getToken, onClose, onReset }) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: "", type: "info" });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const showNotification = (message, type = "info") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 4000);
  };

  useEffect(() => {
    loadMessages();
  }, [chat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(
        `${BACKEND_URL}/conversation/${chat.chat_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load messages", err);
      showNotification("Failed to load chat messages", "error");
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim()) return;

    const userMsg = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMsg]);
    setUserInput("");
    setIsLoading(true);

    try {
      const token = await getToken();
      const res = await axios.post(
        `${BACKEND_URL}/chat`,
        { message: userInput, chat_id: chat.chat_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const history = res.data.history;
      setMessages(history);
    } catch (err) {
      console.error("Failed to send message", err);
      showNotification("Failed to send message", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsSolution = async (messageIndex) => {
    const message = messages[messageIndex];
    if (message.role !== "user") return;

    try {
      const token = await getToken();
      await axios.post(
        `${BACKEND_URL}/assignments/chats/${chat.assignment_chat_id}/mark-solution`,
        {
          message_id: `msg_${messageIndex}`,
          assignment_chat_id: chat.assignment_chat_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification("Solution marked successfully! ✓", "success");
      
      // Update message to show it's marked as solution
      setMessages((prev) => 
        prev.map((msg, idx) => 
          idx === messageIndex 
            ? { ...msg, markedAsSolution: true }
            : msg
        )
      );
    } catch (err) {
      console.error("Failed to mark solution", err);
      showNotification("Failed to mark solution", "error");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset this question? This will start a new chat.")) {
      return;
    }

    try {
      const token = await getToken();
      await axios.post(
        `${BACKEND_URL}/assignments/chats/${chat.assignment_chat_id}/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification("Question reset successfully!", "success");
      setTimeout(() => onReset(), 1000);
    } catch (err) {
      console.error("Failed to reset question", err);
      showNotification("Failed to reset question", "error");
    }
  };

  return (
    <div className="assignment-chat-container">
      {notification.show && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="assignment-chat-header">
        <button onClick={onClose} className="back-button">
          ← Back to Questions
        </button>
        <div className="chat-title">
          <h3>Question {chat.question_order + 1}</h3>
          {chat.status === "solved" && <span className="status-badge solved">✓ Solved</span>}
        </div>
        <button onClick={handleReset} className="reset-button">
          Reset Question
        </button>
      </div>

      <div className="assignment-chat-messages">
        {messages
          .filter((msg) => msg.role !== "system")
          .map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.role === "user" ? "user-message" : "assistant-message"} ${msg.markedAsSolution ? "solution-message" : ""}`}
              onMouseEnter={() => msg.role === "user" && setHoveredMessageId(i)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {msg.role === "assistant" ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked.parse(msg.content || "")),
                  }}
                />
              ) : (
                <div>
                  {msg.content}
                  {msg.markedAsSolution && (
                    <span className="solution-badge">✓ Marked as Solution</span>
                  )}
                </div>
              )}
              
              {msg.role === "user" && hoveredMessageId === i && !msg.markedAsSolution && chat.status !== "solved" && (
                <div className="message-actions">
                  <button
                    onClick={() => markAsSolution(i)}
                    className="mark-solution-button"
                    title="Mark as solution"
                  >
                    ✓ Mark as Solution
                  </button>
                </div>
              )}
            </div>
          ))}
        {isLoading && (
          <div className="message assistant-message">
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="assignment-chat-input">
        <textarea
          ref={inputRef}
          placeholder="Type your answer..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={3}
          disabled={chat.status === "solved"}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !userInput.trim() || chat.status === "solved"}
          className="send-button"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default AssignmentChat;