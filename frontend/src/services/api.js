import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {},
});

let isClearingSession = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isClearingSession) {
      isClearingSession = true;
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('role');
      import('../utils/userSession').then(({ clearUserSessionStorage }) => {
        clearUserSessionStorage();
        isClearingSession = false;
      });
    }
    return Promise.reject(error);
  }
);

export default api;
