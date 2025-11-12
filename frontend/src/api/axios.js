import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

// Store auth functions
let getTokenFunction = null;
let auth0ClientInstance = null;

// Setup function to be called from AuthContext
export const setupAxiosAuth = (getToken, auth0Client) => {
  getTokenFunction = getToken;
  auth0ClientInstance = auth0Client;
};

api.interceptors.request.use(
  async (config) => {
    if (!getTokenFunction || !auth0ClientInstance) {
      return config;
    }

    try {
      // Check if user is authenticated
      const isAuthenticated = auth0ClientInstance.isAuthenticated;
      
      if (!isAuthenticated) {
        console.warn('User not authenticated');
        return config;
      }

      // Get token
      const token = await getTokenFunction();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error('Failed to attach token:', err.message);
      
      // If token refresh fails
      if (err.message?.includes('Refresh Token') || 
          err.message?.includes('login_required') ||
          err.error === 'login_required') {
        console.log('Session expired, redirecting to login...');
        
        try {
          if (auth0ClientInstance && auth0ClientInstance.logout) {
            await auth0ClientInstance.logout();
          }
        } catch (logoutError) {
          console.error('Logout failed:', logoutError);
          window.location.href = '/';
        }
        
        return Promise.reject(new Error('Session expired'));
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.error('Received 401 from backend, session invalid');
      
      try {
        if (auth0ClientInstance && auth0ClientInstance.logout) {
          await auth0ClientInstance.logout();
        }
      } catch (logoutError) {
        console.error('Logout failed:', logoutError);
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export default api;