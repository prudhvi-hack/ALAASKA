import React from "react";

export default function TopBar({
  currentView,
  setCurrentView,
  isAdmin,
  user,
  checkAdminStatus,
  logout,
}) {
  return (
    <div className="top-bar">
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <button
          onClick={() => setCurrentView("chat")}
          style={{
            background: currentView === "chat" ? "lightseagreen" : "transparent",
            color: currentView === "chat" ? "white" : "gray",
            border: "1px solid #e0e0e0",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
          }}
        >
          Chat
        </button>

        <button
          onClick={() => setCurrentView("assignments")}
          style={{
            background: currentView === "assignments" ? "lightseagreen" : "transparent",
            color: currentView === "assignments" ? "white" : "gray",
            border: "1px solid #e0e0e0",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
          }}
        >
          Assignments
        </button>

        {isAdmin && (
          <button
            onClick={() => setCurrentView("admin")}
            style={{
              background: currentView === "admin" ? "lightseagreen" : "transparent",
              color: currentView === "admin" ? "white" : "gray",
              border: "1px solid #e0e0e0",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Admin
          </button>
        )}

      </div>

      <h3 className="top-bar-title">
        {currentView === "chat" && "Study with ALAASKA through Microlearning"}
        {currentView === "assignments" && "My Assignments"}
        {currentView === "admin" && "Admin Panel"}
      </h3>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
        >
          {(user?.name || user?.email)?.slice(0, 2).toUpperCase()}
        </div>
        <span className="user-name-text" style={{ color: "black", fontWeight: "500" }}>
          {user?.name || user?.email}
        </span>
        <button
          onClick={() => logout({ returnTo: window.location.origin })}
          style={{
            marginLeft: "8px",
            background: "whitesmoke",
            borderRadius: "6px",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}