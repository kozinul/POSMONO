import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TerminalCenterPage from '../../src/core/platform/pages/TerminalCenterPage';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import { TestQueryProvider } from '../helpers';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/@shared/hooks/useToast', () => ({
  toast: vi.fn(),
}));

import { api } from '../../src/@shared/services/api';

describe('TerminalCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'u-admin',
        email: 'admin@platform.com',
        displayName: 'Platform Admin',
        roleId: 'r-admin',
        roleName: 'Platform Super Admin',
        permissions: [
          'platform.plans.read',
          'platform.plans.manage',
          'platform.hubs.manage',
          'platform.tenants.read',
          'platform.tenants.manage',
          'outlet:manage',
          'platform.reports.read',
          'platform.audit.read',
        ],
      },
    } as any);

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/platform/hubs') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 'hub-1', name: 'Hub Utama', isActive: true }],
          },
        });
      }
      if (url.startsWith('/platform/tenants')) {
        return Promise.resolve({
          data: {
            success: true,
            data: { data: [{ id: 't-1', name: 'Tenant Alpha', status: 'active', plan: 'Pro' }], total: 1 },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it('renders terminal center title and permitted tab buttons', async () => {
    render(
      <MemoryRouter>
        <TestQueryProvider>
          <TerminalCenterPage />
        </TestQueryProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Terminal Center')).toBeInTheDocument();
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText('Hub & Anggota')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Outlet')).toBeInTheDocument();
    expect(screen.getByText('Ringkasan')).toBeInTheDocument();
    expect(screen.getByText('Konsolidasi')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('switches to Tenants tab when clicked and displays tenant table', async () => {
    render(
      <MemoryRouter>
        <TestQueryProvider>
          <TerminalCenterPage />
        </TestQueryProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('Tenants'));
    expect(await screen.findByText('Tenant Alpha')).toBeInTheDocument();
  });
});
