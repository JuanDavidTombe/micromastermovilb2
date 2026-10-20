import { api } from '@/services/api';
import type { LoginResponse, RegisterPayload } from '@/types/models';

export type RegisterResponse = LoginResponse & { message?: string };

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  register: (payload: RegisterPayload) =>
    api.post<RegisterResponse>('/auth/register', payload),

  me: () => api.get<unknown>('/auth/me'),

  logout: () => api.post<void>('/auth/logout'),
};
