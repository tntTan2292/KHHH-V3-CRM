import { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

// Utility: decode JWT payload without library
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  // Expired if current time >= exp (seconds)
  return Date.now() >= payload.exp * 1000;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      const savedToken = localStorage.getItem('token');
      // [HOTFIX] Defensive Check for corrupted storage
      if (!savedToken || savedToken === 'undefined' || savedToken === 'null' || savedToken === '[object Object]') {
        localStorage.removeItem('token');
        return null;
      }
      
      // Kiểm tra token hết hạn ngay khi khởi tạo
      if (isTokenExpired(savedToken)) {
        localStorage.removeItem('token');
        return null;
      }
      return savedToken;
    } catch (e) {
      console.error("Auth Storage Corruption Detected. Clearing...");
      localStorage.removeItem('token');
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Double check expiry trước khi gọi API
      if (isTokenExpired(token)) {
        logout();
        setLoading(false);
        return;
      }
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Interceptor: tự động logout khi Backend trả 401
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await api.post('/api/auth/login', formData);
      const { access_token, user: userData } = response.data;
      
      if (!access_token) {
        return { success: false, message: 'Phản hồi từ hệ thống không hợp lệ (Missing Token)' };
      }
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData || null);
      
      return { 
        success: true, 
        must_change_password: userData?.must_change_password || false 
      };
    } catch (error) {
      console.error('Login error details:', error.response?.data || error.message);
      return { 
        success: false, 
        message: error.response?.data?.detail || error.message || 'Kết nối máy chủ thất bại' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
