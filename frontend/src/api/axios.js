import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let getTokenFunction = null;

export const setupAxiosInterceptors = (getToken) => {
  getTokenFunction = getToken;
};

api.interceptors.request.use(
  async (config) => {
    if (getTokenFunction) {
      try {
        const token = await getTokenFunction();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to attach token:', error);
        return Promise.reject(error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (getTokenFunction) {
          const token = await getTokenFunction(true);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;