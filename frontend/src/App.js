import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useAuth0 } from "@auth0/auth0-react";
import logo from './assets/alaaska_logo.png'; 

const BACKEND_URL = '';

function App() {
  const { 
    loginWithRedirect, 
    logout, 
    user, 
    isAuthenticated, 
    isLoading: authLoading, 
    getAccessTokenSilently, 
  } = useAuth0();

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  
  // Notification states
  const [notification, setNotification] = useState({ show: false, message: "", type: "error" });
  const [confirmation, setConfirmation] = useState({ show: false, message: "", onConfirm: null });
  
  // Sidebar state: true = show full sidebar, false = show thin sidebar
  const [showFullSidebar, setShowFullSidebar] = useState(window.innerWidth > 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  const [typingText, setTypingText] = useState("");
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Notification helpers
  const showNotification = (message, type = "error") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "error" }), 4000);
  };

  const showConfirmation = (message, onConfirm) => {
    setConfirmation({ show: true, message, onConfirm });
  };

  // Token validation helper
  const validateAndGetToken = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      throw new Error("Not authenticated");
    }
    
    try {
      const token = await getAccessTokenSilently({
        cacheMode: forceRefresh ? 'off' : 'on'  // Always get fresh token to avoid cache issues
      });
      
      if (!token || token.length < 10) {
        throw new Error("Invalid token received");
      }
      return token;
    } catch (error) {
      console.error("Token validation failed:", error);
      throw new Error("Authentication failed");
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Helper function to handle 401 retries
  const handleApiCall = async (apiCallFn) => {
    try {
      return await apiCallFn();
    } catch (error) {
      // If 401, wait a moment and try once more
      if (error.response?.status === 401) {
        console.log("Got 401, waiting and retrying...");
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return await apiCallFn();
      }
      throw error;
    }
  };

  // Track window width and adjust sidebar behavior
  useEffect(() => {
    function handleResize() {
      const newWidth = window.innerWidth;
      setWindowWidth(newWidth);
      
      // Desktop: start with full sidebar, Mobile: start with thin sidebar
      if (newWidth > 768) {
        setShowFullSidebar(true); // Desktop shows full sidebar by default
      } else {
        setShowFullSidebar(false); // Mobile shows thin sidebar by default
      }
    }
    
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [typingText]);

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const loadConversations = async () => {
        try {
          const token = await validateAndGetToken();
          const res = await axios.get(`${BACKEND_URL}/conversations`, {
            headers: { 
              Authorization: `Bearer ${token}`
            },
            withCredentials: true
          });
          setConversations(res.data);
        } catch (err) {
          // If unauthorized, do nothing since Auth0 manages login state
        }
      };
      loadConversations();
    }
  }, [isAuthenticated, getAccessTokenSilently, validateAndGetToken]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [userInput]);

  const sendMessage = async () => {
    if (!userInput.trim()) return;
    if (!isAuthenticated) {
      showNotification("Please login first.");
      return;
    }

    try {
      const token = await validateAndGetToken(false);
      
      const userMsg = { role: "user", content: userInput };
      setMessages((prevMessages) => [...prevMessages, userMsg]);
      setUserInput("");
      setIsLoading(true);
    
      const res = await axios.post(
        `${BACKEND_URL}/chat`,
        { message: userInput, chat_id: chatId },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );

      setChatId(res.data.chat_id);
      console.log("Received valid chat_id from backend:");
      setChatId(res.data.chat_id);
      const assistantMessages = res.data.history.filter((m) => m.role === "assistant");
      const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];

      if (lastAssistantMsg) {
        const fullReply = lastAssistantMsg.content;
        let i = 0;
        setTypingText("");

        const typeInterval = setInterval(() => {
          setTypingText((prev) => {
            const next = prev + fullReply[i];
            i++;
            if (i >= fullReply.length) {
              clearInterval(typeInterval);
              setMessages((prevMessages) => [
                ...prevMessages,
                { role: "assistant", content: fullReply },
              ]);
              setTypingText("");
            }
            return next;
          });
        }, 5);
      }
      setChatId(res.data.chat_id);
      if (messages.filter(m => m.role === "user").length === 0) {
        try {
          setTimeout(async () => {
            const updatedToken = await validateAndGetToken(false);
            const convRes = await axios.get(`${BACKEND_URL}/conversations`, { headers: { Authorization: `Bearer ${updatedToken}` }, withCredentials: true });
            setConversations(convRes.data);
          }, 1000);
        } catch (err) {
          // Ignore refresh errors
        }
      }
      
    } catch (err) {
      console.error("Message send failed");
      if (err.response?.status === 401) {
        showNotification("Session expired or unauthorized. Please log in again.");
      } else {
        showNotification("Failed to send message.");
      }
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
      const token = await validateAndGetToken(false);
      
      const res = await axios.post(
        `${BACKEND_URL}/chat/start`,
        {},
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );

      const newChatId = res.data.chat_id;
      setChatId(newChatId);
      setUserInput("");
      setMessages([
        {
          role: "assistant",
          content: "Hi! Welcome to ALAASKA. How can I help you today?",
        },
      ]);
      setConversations((prevConvos) => [
        { chat_id: newChatId, summary: "New Chat" },
        ...prevConvos.filter((c) => c.chat_id !== newChatId),
      ]);
    } catch (err) {
      console.error("Error starting a new chat!");
      showNotification("Failed to start a new chat.");
    }
  };

  const loadConversation = async (id) => {
    if (!isAuthenticated) {
      showNotification("Please login first.");
      return;
    }
  
    try {
      await handleApiCall(async (forceRefresh = false) => {
        const token = await validateAndGetToken(forceRefresh);
        const res = await axios.get(`${BACKEND_URL}/conversation/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true
        });
        setMessages(res.data);
        setChatId(id);
      });
    } catch (err) {
      console.error("Error loading conversation!", err);
      showNotification("Failed to load conversation.");
    }
  };

  const deleteConversation = (idToDelete) => {
    showConfirmation(
      "Are you sure you want to delete this conversation?",
      async () => {
        try {
          await handleApiCall(async (forceRefresh = false) => {
            const token = await validateAndGetToken(forceRefresh);
            await axios.delete(`${BACKEND_URL}/conversation/${idToDelete}`, {
              headers: { Authorization: `Bearer ${token}` },
              withCredentials: true
            });
          });
  
          if (chatId === idToDelete) {
            setMessages([]);
            setChatId(null);
          }
          setConversations(
            conversations.filter((item) => item.chat_id !== idToDelete)
          );
          showNotification("Conversation deleted successfully.", "success");
        } catch (err) {
          console.error("Error deleting conversation!");
          showNotification("Failed to delete the conversation.");
        }
      }
    );
  };

  // Toggle between full and thin sidebar
  const toggleSidebar = () => {
    setShowFullSidebar(!showFullSidebar);
  };

  if (authLoading) return <div>Loading...</div>;

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
      {/* Notification Toast */}
      {notification.show && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Confirmation Modal */}
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
        {/* Thin Sidebar - Show when showFullSidebar is false */}
        {!showFullSidebar && (
          <div className="thin-sidebar">
            <button
              aria-label="Open full sidebar"
              onClick={toggleSidebar}
              className="thin-sidebar-button toggle-button"
              title="Open full sidebar"
            >
              {/* Default sidebar nav icon [| ] - less bold */}
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="default-icon">
              <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="1.0" fill="none" rx="1"/>
              <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="1.0"/>
              </svg>
              {/* Hover icon -->| - less bold */}
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

        {/* Full Sidebar - Show when showFullSidebar is true */}
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
                  {/* Default sidebar nav icon [| ] - 1.7x bigger, less bold */}
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="default-icon">
                    <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="0.5" fill="none" rx="1"/>
                    <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="0.5"/>
                  </svg>
                  {/* Hover icon |<-- - less bold */}
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

        {/* Overlay for mobile when full sidebar is open */}
        {isMobile && showFullSidebar && (
          <div className="sidebar-overlay" onClick={toggleSidebar}></div>
        )}

        {/* Content Area */}
        <div className={`content-area ${showFullSidebar && !isMobile ? 'with-full-sidebar' : ''} ${!showFullSidebar ? 'with-thin-sidebar' : ''}`}>
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
                  onClick={() => {
                    logout({ returnTo: window.location.origin });
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
