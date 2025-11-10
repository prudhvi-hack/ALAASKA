import React, { useState, useEffect, useRef } from "react";
import logo from './assets/alaaska_logo.png';
import AssignmentsPage from './components/AssignmentsPage';
import AdminPage from './components/AdminPage';
import ChatInterface from './components/ChatInterface';
import { useAuth } from './contexts/AuthContext';
import api from './api/axios'; 

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

  const [autoOpenAssignmentId, setAutoOpenAssignmentId] = useState(null);
  const [autoScrollToQuestionId, setAutoScrollToQuestionId] = useState(null);
  
  const messagesEndRef = useRef(null);

  const handleNavigateToAssignment = (assignmentId, questionId) => {
    setAutoOpenAssignmentId(assignmentId);
    setAutoScrollToQuestionId(questionId);
    setCurrentView('assignments');
    window.history.pushState({}, '', '/');
  };

  const handleClearAutoOpen = () => {
    setAutoOpenAssignmentId(null);
    setAutoScrollToQuestionId(null);
  };

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
  }, [messages]);

  // : Single useEffect with proper error handling  
  // IMPLIFIED: Remove the admin/grader check - backend handles this automatically
useEffect(() => {
  if (!isAuthenticated) return;

  const initialize = async () => {
    try {
      setIsLoading(true);

      // Load conversations - backend automatically returns correct ones based on user role
      const convRes = await api.get('/conversations');
      const fetchedConversations = convRes.data || [];
      setConversations(fetchedConversations);

      // Load initial chat
      const params = new URLSearchParams(window.location.search);
      const urlChatId = params.get('chat_id');

      if (urlChatId) {
        await loadConversation(urlChatId);
      } else if (fetchedConversations.length > 0) {
        await loadConversation(fetchedConversations[0].chat_id);
      } else {
        await startNewChat();
      }

    } catch (err) {
      if (err.message === 'Session expired') {
        console.log('Session expired, user will be redirected to login');
        return;
      }
      
      console.error('Initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  initialize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isAuthenticated]);

useEffect(() => {
  if (!isAuthenticated) return;

  const checkAdminStatus = async () => {
    try {
      const adminRes = await api.get('/admin/check');
      setIsAdmin(adminRes.data.is_admin);
    } catch (err) {
      // Not an admin, that's fine
      if (err.response?.status === 403) {
        setIsAdmin(false);
      }
    }
  };

  checkAdminStatus();
}, [isAuthenticated, setIsAdmin]);

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

    // Add loading indicator
    setMessages((prev) => [...prev, { role: "assistant", content: "", isStreaming: true }]);

    try {
      const res = await api.post('/chat', { message: text, chat_id: chatId });
      
      // Remove loading indicator and add actual response
      setMessages((prev) => {
        const withoutLoader = prev.slice(0, -1);
        return [...withoutLoader, { role: "assistant", content: res.data.response }];
      });

      // Update chat ID if new chat
      if (res.data.chat_id !== chatId) {
        setChatId(res.data.chat_id);
        
        // Refresh conversations list
        setTimeout(async () => {
          try {
            const convRes = await api.get('/conversations');
            setConversations(convRes.data);
          } catch (err) {
            console.error('Failed to refresh conversations:', err);
          }
        }, 500);
      }
    } catch (err) {
      console.error("Message send failed", err);
      showNotification(err.response?.status === 401 ? "Session expired. Please log in again." : "Failed to send message.");
      
      // Remove loading indicator and user message on error
      setMessages((prev) => prev.slice(0, -2));
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
      
      // Handle new response format
      const allMessages = res.data.messages || res.data || [];
      const displayMessages = allMessages.filter(msg => msg.role !== 'system');
      
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
                    className={`conversation-button ${chatId === c.chat_id ? 'active-conversation' : ''}`}
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
            <AssignmentsPage 
              autoOpenAssignmentId={autoOpenAssignmentId}
              autoScrollToQuestionId={autoScrollToQuestionId}
              onClearAutoOpen={handleClearAutoOpen} 
            />
          ) : (
            <ChatInterface
              chatId={chatId}
              messages={messages}
              input={userInput}
              setInput={setUserInput}
              sendMessage={sendMessage}
              onNavigateToAssignment={handleNavigateToAssignment}
            />
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