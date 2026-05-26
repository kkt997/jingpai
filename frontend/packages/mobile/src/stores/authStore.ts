import { create } from 'zustand';
import { User, authApi } from '@jingpai/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (account: string, password: string) => Promise<void>;
  register: (data: { phone?: string; email?: string; nickname: string; password: string }) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (account, password) => {
    const res: any = await authApi.login({ account, password });
    localStorage.setItem('token', res.data.token);
    set({ user: res.data.user, token: res.data.token });
  },

  register: async (data) => {
    const res: any = await authApi.register({ ...data, role: 'USER' });
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
