import React, { useState } from "react";
import axios from "axios";

const BACKEND_URL = "http://localhost:8000";

export default function Register({ setView }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const res = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Registration successful!");
        setView("login"); // optionally go to login screen
      } else {
        alert("Registration failed: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      alert("Registration error: " + err.message);
    }
  };

  return (
    <div className="auth-form-container">
      <h2>Register</h2>
      <input
        className="auth-input"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        className="auth-input"
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="auth-button" onClick={handleRegister}>Register</button>
      <p className="auth-switch-text">
        Already have an account?{" "}
        <button onClick={() => setView("login")}>Login</button>
      </p>
    </div>
  );
}
