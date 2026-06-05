import api from './api';
import { getItem, setItem, deleteItem } from './storage';

export interface User {
  userId: number;
  username: string;
  email?: string;
  roles: string[];
}

export const authService = {
  async login(username: string, password: string): Promise<User> {
    const response = await api.post('/api/auth/login', { username, password });
    const { token, user } = response.data;

    await setItem('accessToken', token);
    await setItem('user', JSON.stringify(user));

    return user;
  },

  async register(username: string, email: string, password: string): Promise<void> {
    await api.post('/api/auth/register', { username, email, password });
  },

  async registerAsConductor(data: { name: string; conductorType?: number; description?: string }): Promise<void> {
    await api.post('/api/Conductor/register', data);
  },

  async registerAsParticipant(data: { name: string; phoneNumber?: string }): Promise<void> {
    await api.post('/api/Participant/register', data);
  },

  async verify(): Promise<User | null> {
    try {
      const response = await api.get('/api/auth/verify');
      return response.data.user || response.data;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try { await api.post('/api/auth/logout'); } catch {}
    await deleteItem('accessToken');
    await deleteItem('user');
  },

  async getStoredUser(): Promise<User | null> {
    const json = await getItem('user');
    return json ? JSON.parse(json) : null;
  },

  async getToken(): Promise<string | null> {
    return getItem('accessToken');
  },
};
