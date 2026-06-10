import axios from 'axios';
import type { ConversationListItem, ConversationMessage, FollowListItem, FollowStatus, MerchantProfileSummary, UserProfileSummary } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
  register: (data: { phone?: string; email?: string; nickname: string; password: string; role: string }) =>
    api.post('/auth/register', data),
  login: (data: { account: string; password: string }) =>
    api.post('/auth/login', data),
  getProfile: () => api.get('/user/profile'),
};

// User
export const userApi = {
  bids: (params?: { auctionId?: number }) => api.get('/user/bids', { params }),
  setBalance: (balance: number) => api.put('/user/balance', { balance }),
};

export const profileApi = {
  user: (id: number) => api.get<UserProfileSummary>(`/users/${id}/profile`),
  merchant: (id: number) => api.get<MerchantProfileSummary>(`/merchants/${id}/profile`),
};

export const followApi = {
  follow: (targetUserId: number) => api.post<FollowStatus>('/follows', { targetUserId }),
  unfollow: (targetUserId: number) => api.delete<FollowStatus>(`/follows/${targetUserId}`),
  status: (targetUserId: number) => api.get<FollowStatus>(`/users/${targetUserId}/follow`),
  following: () => api.get<FollowListItem[]>('/follows/following'),
  followers: () => api.get<FollowListItem[]>('/follows/followers'),
  merchantFollowers: () => api.get<FollowListItem[]>('/merchant/followers'),
};

export const conversationApi = {
  list: () => api.get<ConversationListItem[]>('/conversations'),
  create: (peerUserId: number) => api.post<ConversationListItem>('/conversations', { peerUserId }),
  detail: (id: number) => api.get<ConversationListItem>(`/conversations/${id}`),
  messages: (id: number, params?: { before?: number; limit?: number }) =>
    api.get<ConversationMessage[]>(`/conversations/${id}/messages`, { params }),
  sendMessage: (id: number, content: string) =>
    api.post<ConversationMessage>(`/conversations/${id}/messages`, { content }),
  markRead: (id: number, messageId?: number) => api.post(`/conversations/${id}/read`, { messageId }),
};

// Rooms
export const roomApi = {
  list: (params?: { status?: string }) => api.get('/rooms', { params }),
  get: (id: number) => api.get(`/rooms/${id}`),
  merchantList: (params?: { status?: string }) => api.get('/merchant/rooms', { params }),
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
  get: (id: number) => api.get(`/products/${id}`),
  update: (id: number, data: Record<string, unknown>) => api.put(`/merchant/products/${id}`, data),
  delete: (id: number) => api.delete(`/merchant/products/${id}`),
  listProduct: (id: number) => api.put(`/merchant/products/${id}/list`),
  unlistProduct: (id: number) => api.put(`/merchant/products/${id}/unlist`),
};

// Upload
export const uploadApi = {
  upload: (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/merchant/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
};

// Merchant stats
export const merchantApi = {
  stats: () => api.get('/merchant/stats'),
};

// Auctions
export const auctionApi = {
  list: (params?: { status?: string; roomId?: string }) => api.get('/auctions', { params }),
  get: (id: number) => api.get(`/auctions/${id}`),
  showcase: (roomId: number) => api.get('/auctions/showcase', { params: { roomId } }),
  merchantList: (params?: { status?: string; roomId?: string }) => api.get('/merchant/auctions', { params }),
  create: (data: Record<string, unknown>) => api.post('/merchant/auctions', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/merchant/auctions/${id}`, data),
  start: (id: number) => api.put(`/merchant/auctions/${id}/start`),
  cancel: (id: number, reason?: string) => api.put(`/merchant/auctions/${id}/cancel`, { reason }),
};

// Deposits
export const depositApi = {
  pay: (auctionId: number) => api.post(`/auctions/${auctionId}/deposit`),
  refund: (auctionId: number) => api.post(`/auctions/${auctionId}/deposit/refund`),
  status: (auctionId: number) => api.get(`/auctions/${auctionId}/deposit`),
  list: () => api.get('/user/deposits'),
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
