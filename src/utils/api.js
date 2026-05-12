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
  timeout: 60000, // 60s timeout mặc định cho các nghiệp vụ CRM nặng
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

// Thêm interceptor để xử lý lỗi phản hồi thống nhất
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Không hiện toast nếu là lỗi chủ động hủy (AbortError)
    if (axios.isCancel(error)) {
      console.log('Request cancelled:', error.message);
      return Promise.reject(error);
    }

    const status = error.response ? error.response.status : null;

    if (status === 401) {
      console.error('Unauthorized - Redirecting to login...');
      // localStorage.removeItem('token');
      // window.location.href = '/login';
    } else if (status === 500) {
      console.error('Internal Server Error:', error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request Timeout');
    }

    return Promise.reject(error);
  }
);

api.isCancel = axios.isCancel;

export default api;
export { getBaseUrl };
