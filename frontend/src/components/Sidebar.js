import React from "react";
import logo from '../assets/alaaska_logo.png';

export default function Sidebar({
  conversations = [],
  loadConversation,
  startNewChat,
  deleteConversation,
  showFullSidebar,
  isMobile,
  toggleSidebar,
}) {
  return (
    <>
      {!showFullSidebar && (
        <div className="thin-sidebar">
          <button aria-label="Open full sidebar" onClick={toggleSidebar} className="thin-sidebar-button toggle-button" title="Open full sidebar">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="default-icon">
              <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="1.0" fill="none" rx="1"/>
              <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="1.0"/>
            </svg>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="hover-icon">
              <path d="M8 12h8M12 8l4 4-4 4" stroke="currentColor" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="20" y1="6" x2="20" y2="18" stroke="currentColor" strokeWidth="1.0"/>
            </svg>
          </button>
          
          <button className="thin-sidebar-button new-chat-thin" onClick={startNewChat} title="New chat">
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
              <button aria-label="Hide sidebar" onClick={toggleSidebar} className="close-sidebar-button toggle-button sidebar-toggle-left" title="Hide sidebar">
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
            
            <button className="new-chat-button" onClick={startNewChat} title="Start new chat">
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
              <div key={c.chat_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button className="conversation-button" onClick={() => loadConversation(c.chat_id)} style={{ flex: 1, marginRight: "0.5rem" }} title={c.summary}>
                  {c.summary}
                </button>
                <button className="icon-button delete-button" onClick={() => deleteConversation(c.chat_id)} title="Delete conversation" aria-label="Delete conversation">
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
    </>
  );
}