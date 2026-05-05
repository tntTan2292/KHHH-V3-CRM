import axios from 'axios';

// Tự động xác định Base URL của Backend dựa trên địa chỉ trình duyệt
// Nếu đang chạy ở localhost -> trỏ về localhost:8000
// Nếu đang chạy ở IP mạng (VD: 10.47.33.24) -> trỏ về IP đó:8000
const getBaseUrl = () => {
  const hostname = window.location.hostname;
  return `http://${hostname}:8000`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Thêm interceptor để đính kèm token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Elite Simulation Support (RBAC 3.0)
  const simulateUserId = localStorage.getItem('simulate_user_id');
  if (simulateUserId) {
    config.headers['X-Simulate-User-ID'] = simulateUserId;
  }
  
  return config;
});

export default api;
export { getBaseUrl };
