import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import Login from "./Login";
import Register from "./Register";
import logo from './assets/alaaska_logo.png';

const BACKEND_URL = "http://localhost:8000"; // Make sure this matches your backend URL

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [conversations, setConversations] = useState([]);
  const [view, setView] = useState("login"); // "login" or "register" or "chat"
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const inputRef = useRef(null);

  // Track window width to toggle responsive layout
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth <= 768) {
        setIsSidebarVisible(false);
      } else {
        setIsSidebarVisible(true);
      }
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);

      axios
        .get(`${BACKEND_URL}/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setConversations(res.data))
        .catch(() => {
          setView("login");
        });
    }
  }, [token]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [userInput]);

  const sendMessage = () => {
    if (!userInput.trim()) return;
    if (!token) {
      alert("Please login first.");
      return;
    }

    setIsLoading(true);

    axios
      .post(
        `${BACKEND_URL}/chat`,
        { message: userInput, chat_id: chatId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        setMessages((prevMessages) => {
          const historyFromServer = res.data.history;
          const newMessages = historyFromServer.slice(-2); // user + assistant
          return [...prevMessages, ...newMessages];
        });

        setChatId(res.data.chat_id);
        setUserInput("");
      })
      .catch((err) => {
        console.error("Error sending message:", err);
        if (err.response?.status === 401) {
          alert("Session expired or unauthorized. Please log in again.");
          localStorage.removeItem("token");
          setToken("");
          setView("login");
        } else {
          alert("Failed to send message.");
        }
      })
      .finally(() => setIsLoading(false));
  };

  const startNewChat = () => {
    if (!token) {
      alert("Please login first.");
      return;
    }

    axios
      .post(
        `${BACKEND_URL}/chat/start`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      .then((res) => {
        setChatId(res.data.chat_id);
        setUserInput("");
        setMessages([
          {
            role: "assistant",
            content: "Hi! Welcome to ALAASKA. How can I help you today?",
          },
        ]);
      })
      .catch((err) => {
        console.error("Error starting new chat:", err);
        alert("Failed to start a new chat.");
      });
  };

  const loadConversation = (id) => {
    if (!token) {
      alert("Please login first.");
      return;
    }

    axios
      .get(`${BACKEND_URL}/conversation/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMessages(res.data);
        setChatId(id);
      })
      .catch((err) => {
        console.error("Error loading conversation:", err);
        alert("Failed to load conversation.");
      });
  };

  const deleteConversation = (idToDelete) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation?"
    );
    if (!confirmed) return;

    axios
      .delete(`${BACKEND_URL}/conversation/${idToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        if (chatId === idToDelete) {
          setMessages([]);
          setChatId(null);
        }
        setConversations(
          conversations.filter((item) => item.chat_id !== idToDelete)
        );
      })
      .catch((err) => {
        console.error("Error deleting conversation:", err);
        alert("Failed to delete the conversation.");
      });
  };

  if (!token) {
    return (
      <div className="auth-container">
        {view === "login" ? (
          <Login setToken={setToken} setView={setView} setUsername={setUsername} />
        ) : (
          <Register setView={setView} />
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="app-wrapper"
        style={{
          flexDirection: windowWidth <= 768 ? "column" : "row",
        }}
      >
        {/* Hamburger toggle button on mobile/tablet */}
        {windowWidth <= 768 && (
          <button
            aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            style={{
              position: "fixed",
              top: "10px",
              left: "10px",
              zIndex: 200,
              backgroundColor: "lightseagreen",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            {isSidebarVisible ? "Close Menu" : "Menu"}
          </button>
        )}

        {/* Sidebar stays full height or toggled */}
        {isSidebarVisible && (
          <div className="sidebar">
            <div className="sidebar-top">
            <div className="sidebar-header">
              <img src={logo} alt="Logo" className="sidebar-logo" />
              <span className="sidebar-title">ALAASKA</span>
            </div>
            <button
              className="new-chat-button"
              onClick={startNewChat}
              title="Start new chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <rect x="3" y="4" width="14" height="16" rx="2" ry="2" />
                <path d="M17 7l-5 5-1 3 3-1 6-6-3-3z" />
              </svg>{" "}
              New Chat
            </button>
            </div>
 
            <div className="sidebar-scroll">
            <h4 className="chat-title">Chats</h4>
            {conversations.length === 0 && <p>No chats yet.</p>}
            {conversations.map((c) => (
              <div
                key={c.chat_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <button
                  className="conversation-button"
                  onClick={() => loadConversation(c.chat_id)}
                  style={{ flex: 1, marginRight: "0.5rem" }}
                  title={c.summary}
                >
                  {c.summary}
                </button>
                <button
                  className="icon-button delete-button"
                  onClick={() => deleteConversation(c.chat_id)}
                  title="Delete conversation"
                  aria-label="Delete conversation"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="grey"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 6h18v2H3V6zm2 3h14l-1.5 13h-11L5 9zm5 2v9h2v-9H10zm4 0v9h2v-9h-2zM9 4V2h6v2h5v2H4V4h5z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          </div>
        )}

        {/* Right side of app: top bar + main content + footer */}
        <div className="content-area">
          <div className="top-bar">
            <h3 className="top-bar-title">
              Study with ALAASKA through Microlearning
            </h3>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  backgroundColor: "lightseagreen",
                  color: "white",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
                title={username}
                onClick={() => setShowLogout(!showLogout)}
              >
                {username.slice(0, 2)}
              </div>
              <span style={{ color: "black", fontWeight: "500" }}>{username}</span>
              {showLogout && (
                <button
                  style={{
                    position: "absolute",
                    top: "40px",
                    right: 0,
                    backgroundColor: "whitesmoke",
                    color: "darkslategrey",
                    border: "black",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "4px",
                    zIndex: 10,
                  }}
                  onClick={() => {
                    localStorage.removeItem("token");
                    setToken("");
                    setUsername("");
                    setView("login");
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          </div>

          <div className="container">
            <div className="main">
              <div className="chatbox">
                <div className="messages">
                <div class="messages-inner">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`message ${
                        msg.role === "user" ? "user-message" : "assistant-message"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(marked.parse(msg.content || "")),
                          }}
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="message assistant-message">
                      <em>Assistant is typing...</em>
                    </div>
                  )}
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
                  <button
                    className="send-button"
                    onClick={sendMessage}
                    title="Send"
                    aria-label="Send message"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                    >
                      <path d="M15.854.146a.5.5 0 0 1 .11.54l-6 14a.5.5 0 0 1-.948-.032l-2-6-6-2a.5.5 0 0 1 .032-.948l14-6a.5.5 0 0 1 .806.44zM6.832 8.065l1.476 4.427 4.318-10.078L6.832 8.065z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="footer">
            ALAASKA: Adaptive Learning for All through AI-Powered Student Knowledge Assessment.
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
