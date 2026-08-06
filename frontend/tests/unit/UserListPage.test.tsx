import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserListPage from '../../src/core/users/pages/UserListPage';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/@shared/hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('../../src/@shared/hooks/useSweetAlert', () => ({
  useSweetAlert: () => vi.fn().mockResolvedValue({ isConfirmed: true }),
}));

import { api } from '../../src/@shared/services/api';

const roles = [
  { id: 'r-manager', name: 'Manager', description: '', permissions: ['order:void', 'payment:void'], isSystem: true, createdAt: '' },
  { id: 'r-cashier', name: 'Cashier', description: '', permissions: ['orders:read'], isSystem: true, createdAt: '' },
];

const users = [
  { id: 'u1', email: 'manager@demo.com', displayName: 'Manager Toko', roleId: 'r-manager', isActive: true, lastLoginAt: null, createdAt: '' },
  { id: 'u2', email: 'cashier@demo.com', displayName: 'Kasir Demo', roleId: 'r-cashier', isActive: false, lastLoginAt: null, createdAt: '' },
];

function mockApi() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/users') return Promise.resolve({ data: { success: true, data: users } });
    if (url === '/roles') return Promise.resolve({ data: { success: true, data: roles } });
    return Promise.resolve({ data: { success: true, data: [] } });
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: {} } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: {} } });
  vi.mocked(api.delete).mockResolvedValue({ data: {} });
}

describe('UserListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('renders users with role names', async () => {
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Manager Toko')).toBeInTheDocument();
    expect(screen.getByText('Kasir Demo')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Cashier')).toBeInTheDocument();
    expect(screen.getByText('Nonaktif')).toBeInTheDocument();
  });

  it('shows PIN field for user with void permission', async () => {
    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    await user.click((await screen.findAllByText('Edit'))[0]);

    expect(await screen.findByPlaceholderText('4-6 digit')).toBeInTheDocument();
    expect(screen.getByText(/PIN dipakai untuk persetujuan void/)).toBeInTheDocument();
  });

  it('hides PIN field for user without void permission, shows when role switches', async () => {
    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    const editButtons = await screen.findAllByText('Edit');
    await user.click(editButtons[1]);

    expect(await screen.findByText('Edit User')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('4-6 digit')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'r-manager');

    expect(await screen.findByPlaceholderText('4-6 digit')).toBeInTheDocument();
  });

  it('rejects mismatched PIN confirmation without calling API', async () => {
    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    await user.click((await screen.findAllByText('Edit'))[0]);
    await user.type(await screen.findByPlaceholderText('4-6 digit'), '1234');
    await user.type(screen.getByPlaceholderText('Ulangi PIN'), '9999');
    await user.click(screen.getByRole('button', { name: /Simpan/i }));

    expect(await screen.findByText('Konfirmasi PIN tidak sama')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('submits valid PIN to update user', async () => {
    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    await user.click((await screen.findAllByText('Edit'))[0]);
    await user.type(await screen.findByPlaceholderText('4-6 digit'), '123456');
    await user.type(screen.getByPlaceholderText('Ulangi PIN'), '123456');
    await user.click(screen.getByRole('button', { name: /Simpan/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/users/u1', {
        displayName: 'Manager Toko',
        roleId: 'r-manager',
        pin: '123456',
      });
    });
  });

  it('creates a new user via POST', async () => {
    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Tambah User/i }));
    await user.type(await screen.findByLabelText('Email'), 'kasir2@demo.com');
    await user.type(screen.getByLabelText('Nama Tampilan'), 'Kasir Dua');
    await user.selectOptions(screen.getByRole('combobox'), 'r-cashier');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /Simpan/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users', {
        email: 'kasir2@demo.com',
        displayName: 'Kasir Dua',
        roleId: 'r-cashier',
        password: 'secret123',
        pin: undefined,
      });
    });
  });

  it('deletes a user via DELETE', async () => {
    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <UserListPage />
      </TestQueryProvider>,
    );

    await screen.findByText('Kasir Demo');
    await user.click((await screen.findAllByText('Hapus'))[1]);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/users/u2');
    });
  });
});
