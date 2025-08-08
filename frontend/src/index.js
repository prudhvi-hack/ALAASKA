import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { Auth0Provider } from '@auth0/auth0-react';

const domain = process.env.REACT_APP_AUTH0_DOMAIN;
const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID;
const audience = process.env.REACT_APP_AUTH0_API_AUDIENCE; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience: audience, // Add this - crucial for getting proper JWT tokens
      scope: "openid profile email", 
      useRefreshTokens:true,
      cacheLocation:"memory"
    }}
  >
    <App />
  </Auth0Provider>
);
