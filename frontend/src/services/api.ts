import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api',
});

// Request Interceptor: Attach token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Handle auth errors globally
api.interceptors.response.use(
  (response) => response, // pass through successful responses
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear session and redirect to login
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      // Only redirect if not already on login/public pages
      const publicPaths = ['/login', '/register-shop', '/register-user', '/', '/support'];
      if (!publicPaths.some(p => window.location.pathname === p)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;