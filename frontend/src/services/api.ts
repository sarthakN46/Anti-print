import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Points to your Node.js Backend
});

// Automatic Security: Attach Token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;