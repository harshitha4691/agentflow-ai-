import { create } from 'zustand';
import api from '../lib/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  ready: false,
  setSession: ({ user, token }) => {
    if (token) localStorage.setItem('token', token);
    set({ user, token });
  },
  bootstrap: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      set({ ready: true });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token, ready: true });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, ready: true });
    }
  },
  login: async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    return data;
  },
  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    return data;
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  }
}));
