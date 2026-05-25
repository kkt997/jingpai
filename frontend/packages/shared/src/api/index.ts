import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

// Auth
export const authApi = {
  register: (data: { phone: string; nickname: string; password: string; role: string }) =>
    api.post('/auth/register', data),
  login: (data: { phone: string; password: string }) =>
    api.post('/auth/login', data),
  getProfile: () => api.get('/user/profile'),
};

// User
export const userApi = {
  bids: (params?: { auctionId?: number }) => api.get('/user/bids', { params }),
};

// Rooms
export const roomApi = {
  list: (params?: { status?: string }) => api.get('/rooms', { params }),
  get: (id: number) => api.get(`/rooms/${id}`),
  create: (data: { title: string; coverUrl?: string; streamUrl?: string }) =>
    api.post('/merchant/rooms', data),
  start: (id: number) => api.put(`/merchant/rooms/${id}/start`),
  end: (id: number) => api.put(`/merchant/rooms/${id}/end`),
};

// Products
export const productApi = {
  create: (data: { title: string; description?: string; images: string[]; category?: string }) =>
    api.post('/merchant/products', data),
  list: () => api.get('/merchant/products'),
  update: (id: number, data: Record<string, unknown>) => api.put(`/merchant/products/${id}`, data),
  delete: (id: number) => api.delete(`/merchant/products/${id}`),
};

// Merchant stats
export const merchantApi = {
  stats: () => api.get('/merchant/stats'),
};

// Auctions
export const auctionApi = {
  list: (params?: { status?: string; roomId?: string }) => api.get('/auctions', { params }),
  get: (id: number) => api.get(`/auctions/${id}`),
  create: (data: Record<string, unknown>) => api.post('/merchant/auctions', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/merchant/auctions/${id}`, data),
  start: (id: number) => api.put(`/merchant/auctions/${id}/start`),
  cancel: (id: number, reason?: string) => api.put(`/merchant/auctions/${id}/cancel`, { reason }),
};

// Orders
export const orderApi = {
  list: () => api.get('/orders'),
  merchantList: () => api.get('/merchant/orders'),
  get: (id: number) => api.get(`/orders/${id}`),
  pay: (id: number) => api.post(`/orders/${id}/pay`),
  confirm: (id: number) => api.post(`/orders/${id}/confirm`),
  cancel: (id: number) => api.post(`/orders/${id}/cancel`),
  ship: (id: number) => api.post(`/merchant/orders/${id}/ship`),
};

export default api;
