import { create } from 'zustand';
import { User, authApi } from '@jingpai/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, nickname: string, password: string) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (phone, password) => {
    const res: any = await authApi.login({ phone, password });
    localStorage.setItem('token', res.data.token);
    set({ user: res.data.user, token: res.data.token });
  },

  register: async (phone, nickname, password) => {
    const res: any = await authApi.register({ phone, nickname, password, role: 'USER' });
    localStorage.setItem('token', res.data.token);
    set({ user: res.data.user, token: res.data.token });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  loadProfile: async () => {
    try {
      const res: any = await authApi.getProfile();
      set({ user: res.data });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },
}));
