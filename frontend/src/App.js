import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import logo from './assets/alaaska_logo.png';
import AssignmentsPage from './components/AssignmentsPage';
import AdminPage from './components/AdminPage';
import { useAuth } from './contexts/AuthContext';
import api, { setupAxiosInterceptors } from './api/axios';

function App() {
  const { user, isAuthenticated, isLoading: authLoading, isAdmin, setIsAdmin, getToken, loginWithRedirect, logout } = useAuth();

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [currentView, setCurrentView] = useState('chat');

  const [notification, setNotification] = useState({ show: false, message: "", type: "error" });
  const [confirmation, setConfirmation] = useState({ show: false, message: "", onConfirm: null });
  
  const [showFullSidebar, setShowFullSidebar] = useState(window.innerWidth > 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [typingText, setTypingText] = useState("");
  
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setupAxiosInterceptors(getToken);
  }, [getToken]);

  const showNotification = (message, type = "error") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "error" }), 4000);
  };

  const showConfirmation = (message, onConfirm) => {
    setConfirmation({ show: true, message, onConfirm });
  };

  useEffect(() => {
    function handleResize() {
      const newWidth = window.innerWidth;
      setWindowWidth(newWidth);
      setShowFullSidebar(newWidth > 768);
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText]);

  // FIX: Check URL params on mount AND when isAuthenticated changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const urlParams = new URLSearchParams(window.location.search);
    const chatIdFromUrl = urlParams.get('chat_id');
    const isAssignment = urlParams.get('assignment') === 'true';
    
    if (chatIdFromUrl && isAssignment) {
      // IMPORTANT: Set view to 'chat' BEFORE loading conversation
      setCurrentView('chat');
      loadConversation(chatIdFromUrl);
      // Clean URL after loading
      window.history.replaceState({}, document.title, '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const initialize = async () => {
      try {
        const [convRes, adminRes] = await Promise.all([
          api.get('/conversations'),
          api.get('/admin/check')
        ]);
        setConversations(convRes.data);
        setIsAdmin(!!adminRes.data.is_admin);
      } catch (err) {
        console.error('Initialization failed:', err);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [userInput]);

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading) return;
    if (!isAuthenticated) {
      showNotification("Please login first.");
      return;
    }

    const text = userInput;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setUserInput("");
    setIsLoading(true);

    try {
      const res = await api.post('/chat', { message: text, chat_id: chatId });
      setChatId(res.data.chat_id);

      const assistantMessages = res.data.history.filter((m) => m.role === "assistant");
      const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];

      if (lastAssistantMsg) {
        const fullReply = lastAssistantMsg.content || "";
        let i = 0;
        setTypingText("");
        const typeInterval = setInterval(() => {
          setTypingText((prev) => {
            const next = prev + fullReply[i];
            i++;
            if (i >= fullReply.length) {
              clearInterval(typeInterval);
              setMessages((prevMsgs) => [...prevMsgs, { role: "assistant", content: fullReply }]);
              setTypingText("");
            }
            return next;
          });
        }, 5);
      }

      if (messages.filter(m => m.role === "user").length === 0) {
        setTimeout(async () => {
          try {
            const convRes = await api.get('/conversations');
            setConversations(convRes.data);
          } catch {}
        }, 1000);
      }
    } catch (err) {
      console.error("Message send failed", err);
      showNotification(err.response?.status === 401 ? "Session expired. Please log in again." : "Failed to send message.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = async () => {
    if (!isAuthenticated) {
      showNotification("Please login first.");
      return;
    }
    try {
      setCurrentView('chat');
      const res = await api.post('/chat/start');
      const newChatId = res.data.chat_id;
      setChatId(newChatId);
      setUserInput("");
      setMessages([{ role: "assistant", content: "Hi! Welcome to ALAASKA. How can I help you today?" }]);
      setConversations((prevConvos) => [
        { chat_id: newChatId, summary: "New Chat" },
        ...prevConvos.filter((c) => c.chat_id !== newChatId),
      ]);
    } catch (err) {
      console.error("Error starting new chat:", err);
      showNotification("Failed to start a new chat.");
    }
  };

  const loadConversation = async (id) => {
    if (!isAuthenticated) {
      showNotification("Please login first.");
      return;
    }
    try {
      setCurrentView('chat');
      const res = await api.get(`/conversation/${id}`);
      const displayMessages = (Array.isArray(res.data) ? res.data : []).filter(msg => msg.role !== 'system');
      setMessages(displayMessages);
      setChatId(id);
      if (windowWidth <= 768) setShowFullSidebar(false);
    } catch (err) {
      console.error("Error loading conversation:", err);
      showNotification("Failed to load conversation.");
    }
  };

  const deleteConversation = (idToDelete) => {
    showConfirmation("Are you sure you want to delete this conversation?", async () => {
      try {
        await api.put(`/conversation/${idToDelete}/delete`);
        if (chatId === idToDelete) {
          setMessages([]);
          setChatId(null);
        }
        setConversations((prev) => prev.filter((item) => item.chat_id !== idToDelete));
        showNotification("Conversation deleted successfully.", "success");
      } catch (err) {
        console.error("Error deleting conversation:", err);
        showNotification("Failed to delete the conversation.");
      }
    });
  };

  const toggleSidebar = () => {
    setShowFullSidebar(!showFullSidebar);
  };

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <img src={logo} alt="Alaaska logo" className="auth-logo" />
        <h1>Welcome to ALAASKA</h1>
        <p>Your AI-powered adaptive learning assistant.</p>
        <button onClick={() => loginWithRedirect()} className="auth-button">
          Log In
        </button>
      </div>
    );
  }

  const isMobile = windowWidth <= 768;

  return (
    <>
      {notification.show && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {confirmation.show && (
        <div className="confirmation-overlay">
          <div className="confirmation-modal">
            <p>{confirmation.message}</p>
            <div className="confirmation-buttons">
              <button 
                onClick={() => {
                  confirmation.onConfirm();
                  setConfirmation({ show: false, message: "", onConfirm: null });
                }}
                className="confirm-btn"
              >
                Yes
              </button>
              <button 
                onClick={() => setConfirmation({ show: false, message: "", onConfirm: null })}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-wrapper">
        {!showFullSidebar && (
          <div className="thin-sidebar">
            <button
              aria-label="Open full sidebar"
              onClick={toggleSidebar}
              className="thin-sidebar-button toggle-button"
              title="Open full sidebar"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="default-icon">
                <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="1.0" fill="none" rx="1"/>
                <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="1.0"/>
              </svg>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="hover-icon">
                <path d="M8 12h8M12 8l4 4-4 4" stroke="currentColor" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="20" y1="6" x2="20" y2="18" stroke="currentColor" strokeWidth="1.0"/>
              </svg>
            </button>
            
            <button
              className="thin-sidebar-button new-chat-thin"
              onClick={startNewChat}
              title="New chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        )}

        {showFullSidebar && (
          <div className={`sidebar ${isMobile ? "sidebar-mobile" : ""}`}>
            <div className="sidebar-top">
              <div className="sidebar-header">
                <button
                  aria-label="Hide sidebar"
                  onClick={toggleSidebar}
                  className="close-sidebar-button toggle-button sidebar-toggle-left"
                  title="Hide sidebar"
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="default-icon">
                    <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="0.5" fill="none" rx="1"/>
                    <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="0.5"/>
                  </svg>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="hover-icon">
                    <line x1="4" y1="6" x2="4" y2="18" stroke="currentColor" strokeWidth="1.0"/>
                    <path d="M16 12H8M12 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <img src={logo} alt="Alaaska Logo" className="sidebar-logo" />
                <span className="sidebar-title">ALAASKA</span>
              </div>
              <button
                className="new-chat-button"
                onClick={startNewChat}
                title="Start new chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
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

        {isMobile && showFullSidebar && (
          <div className="sidebar-overlay" onClick={toggleSidebar}></div>
        )}

        <div className={`content-area ${showFullSidebar && !isMobile ? 'with-full-sidebar' : ''} ${!showFullSidebar ? 'with-thin-sidebar' : ''}`}>
          <div className="top-bar">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentView('chat')}
                style={{
                  background: currentView === 'chat' ? 'lightseagreen' : 'transparent',
                  color: currentView === 'chat' ? 'white' : 'gray',
                  border: '1px solid #e0e0e0',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Chat
              </button>
              <button
                onClick={() => setCurrentView('assignments')}
                style={{
                  background: currentView === 'assignments' ? 'lightseagreen' : 'transparent',
                  color: currentView === 'assignments' ? 'white' : 'gray',
                  border: '1px solid #e0e0e0',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Assignments
              </button>
              {isAdmin && (
                <button
                  onClick={() => setCurrentView('admin')}
                  style={{
                    background: currentView === 'admin' ? 'lightseagreen' : 'transparent',
                    color: currentView === 'admin' ? 'white' : 'gray',
                    border: '1px solid #e0e0e0',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Admin
                </button>
              )}
              
              {user?.email === 'gvp5349@psu.edu' && !isAdmin && (
                <button
                  onClick={async () => {
                    try {
                      await api.post('/admin/initialize');
                      showNotification('Super admin initialized!', 'success');
                      const res = await api.get('/admin/check');
                      setIsAdmin(!!res.data.is_admin);
                    } catch (err) {
                      console.error('Initialize error:', err);
                      showNotification(err.response?.data?.detail || 'Failed to initialize', 'error');
                    }
                  }}
                  style={{
                    background: '#f39c12',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🔑 Initialize Super Admin
                </button>
              )}
            </div>

            <h3 className="top-bar-title">
              {currentView === 'chat' && 'Study with ALAASKA through Microlearning'}
              {currentView === 'assignments' && 'My Assignments'}
              {currentView === 'admin' && 'Admin Panel'}
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
                title={user?.name || user?.email}
                onClick={() => setShowLogout(!showLogout)}
              >
                {(user?.name || user?.email)?.slice(0, 2).toUpperCase()}
              </div>
              <span className="user-name-text" style={{ color: "black", fontWeight: "500" }}>
                {user?.name || user?.email}
              </span>
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
                  onClick={() => logout()}
                >
                  Logout
                </button>
              )}
            </div>
          </div>
          
          {currentView === 'admin' ? (
            <AdminPage />
          ) : currentView === 'assignments' ? (
            <AssignmentsPage />
          ) : (
            <div className="container">
              <div className="main">
                <div className="chatbox">
                  <div className="messages">
                    <div className="messages-inner">
                      {messages
                        .filter((msg) => msg.role !== "system")
                        .map((msg, i) => (
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
                      {typingText ? (
                        <div className="message assistant-message">
                          <span
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(marked.parse(typingText)),
                            }}
                          />
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
                    <button
                      className="send-button"
                      onClick={sendMessage}
                      title="Send"
                      aria-label="Send message"
                      disabled={isLoading || !userInput.trim()}
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
          )}

          <div className="footer">
            ALAASKA: Adaptive Learning for All through AI-Powered Student Knowledge Assessment.
          </div>
        </div>
      </div>
    </>
  );
}

export default App;