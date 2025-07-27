import React, { useState } from "react";
import axios from "axios";

const BACKEND_URL = "http://localhost:8000";

export default function Login({ setToken, setView, setUsername }) {
  const [username, setLocalUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    axios.post(`${BACKEND_URL}/token`, form)
      .then(res => {
        localStorage.setItem("token", res.data.access_token);
        setToken(res.data.access_token);
        setUsername(username);  // update App.js username state
        setView("chat");
      })
      .catch(() => alert("Login failed"));
  };

  return (
    <div className="auth-form-container">
      <h2>Login</h2>
      <input
        className="auth-input"
        placeholder="Username"
        value={username}
        onChange={e => setLocalUsername(e.target.value)}
      />
      <input
        className="auth-input"
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="auth-button" onClick={handleLogin}>Login</button>
      <p className="auth-switch-text">
        Don't have an account?{" "}
        <button onClick={() => setView("register")}>Register</button>
      </p>
    </div>
  );
}


