import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface User {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  roleId: string;
  password: string;
  pin?: string | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  displayName?: string;
  roleId?: string;
  password?: string;
  pin?: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: User[] }>('/users');
      return res.data.data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Role[] }>('/roles');
      return res.data.data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateUserInput) => {
      const res = await api.put<{ success: boolean; data: User }>(`/users/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await api.post<{ success: boolean; data: User }>('/users', data);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await api.post<{ success: boolean }>(`/users/${id}/${isActive ? 'activate' : 'deactivate'}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
