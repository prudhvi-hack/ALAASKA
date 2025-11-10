import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setupAxiosAuth } from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect, logout, user, isLoading } = useAuth0();
  const [isAdmin, setIsAdmin] = useState(false);
  const tokenRef = useRef(null);
  const tokenExpiryRef = useRef(null);

  const getToken = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const now = Date.now();
      
      if (!forceRefresh && tokenRef.current && tokenExpiryRef.current && (tokenExpiryRef.current - now) > 300000) {
        return tokenRef.current;
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.REACT_APP_AUTH0_API_AUDIENCE,
        },
      });

      tokenRef.current = token;
      tokenExpiryRef.current = now + 3600000;
      return token;
    } catch (error) {
      console.error('Token fetch failed:', error);
      tokenRef.current = null;
      tokenExpiryRef.current = null;
      
      if (error.error === 'login_required' || error.error === 'consent_required') {
        await loginWithRedirect();
      }
      throw error;
    }
  }, [getAccessTokenSilently, isAuthenticated, loginWithRedirect]);

  const handleLogout = useCallback(() => {
    tokenRef.current = null;
    tokenExpiryRef.current = null;
    setIsAdmin(false);
    logout({ returnTo: window.location.origin });
  }, [logout]);

  // up axios with auth functions when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const auth0Instance = {
        isAuthenticated,
        logout: handleLogout
      };
      
      setupAxiosAuth(getToken, auth0Instance);
    }
  }, [isAuthenticated, getToken, handleLogout]);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    setIsAdmin,
    getToken,
    loginWithRedirect,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};