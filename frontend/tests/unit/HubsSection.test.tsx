import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HubsSection from '../../src/core/platform/components/HubsSection';
import { TestQueryProvider } from '../helpers';

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

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(async (options: Record<string, unknown> = {}) => {
      const preConfirm = options.preConfirm as ((value: string) => Promise<boolean>) | undefined;
      if (preConfirm) {
        const inputType = options.input as string | undefined;
        const ok = await preConfirm(inputType === 'number' ? '30' : 'alasan test');
        if (!ok) return { isConfirmed: false };
      }
      return { isConfirmed: true, value: 'alasan test' };
    }),
    showValidationMessage: vi.fn(),
  },
}));

import { api } from '../../src/@shared/services/api';

const hubs = [
  { id: 'hub-1', name: 'BCA Hospitality', description: 'Grup ritel', isActive: true, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
  { id: 'hub-2', name: 'Maju Grup', description: null, isActive: false, createdAt: '2026-09-02', updatedAt: '2026-09-02' },
];

const hubDetail = {
  ...hubs[0],
  tenants: [{ id: 'tenant-1', name: 'Kopi Bali', slug: 'kopi-bali', businessType: 'cafe', status: 'active', plan: 'Pro', hubId: 'hub-1' }],
  tenantCount: 1,
};

const members = [
  { id: 'm1', hubId: 'hub-1', userId: 'u1', role: 'owner' as const, displayName: 'Budi', email: 'budi@kopi.id', userTenantId: 'tenant-1', userTenantName: 'Alpha Kopi', createdAt: '', updatedAt: '' },
];

const otherTenant = {
  id: 'tenant-2',
  name: 'Roti Manis',
  slug: 'roti-manis',
  businessType: 'bakery',
  status: 'active',
  plan: 'Trial',
  hubId: 'hub-2',
  hubName: 'Maju Grup',
};

function tenantPage(rows: unknown[]) {
  return Promise.resolve({
    data: { success: true, data: { data: rows, total: rows.length, page: 1, limit: 20 } },
  });
}

function mockApi(usersSummary?: unknown[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/platform/hubs') return Promise.resolve({ data: { success: true, data: hubs } });
    if (url === '/platform/hubs/hub-1') {
      return Promise.resolve({ data: { success: true, data: usersSummary ? { ...hubDetail, usersSummary } : hubDetail } });
    }
    if (url === '/hub-memberships/hub/hub-1') return Promise.resolve({ data: { success: true, data: members } });
    if (url.startsWith('/platform/users')) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            data: [
              {
                id: 'u1',
                displayName: 'Budi',
                email: 'budi@kopi.id',
                tenantId: 'tenant-1',
                tenantName: 'Kopi Bali',
                roleId: 'r1',
                roleName: 'Owner',
                isActive: true,
                isHubMember: true,
              },
              {
                id: 'u2',
                displayName: 'Sari',
                email: 'sari@kopi.id',
                tenantId: 'tenant-2',
                tenantName: 'Roti Manis',
                roleId: 'r2',
                roleName: 'Cashier',
                isActive: true,
                isHubMember: false,
              },
            ],
            total: 2,
            page: 1,
            limit: 20,
          },
        },
      });
    }
    if (url.startsWith('/platform/tenants?')) return tenantPage([hubDetail.tenants[0], otherTenant]);
    if (url === '/platform/tenants') return tenantPage([hubDetail.tenants[0]]);
    return Promise.resolve({ data: { success: true, data: [] } });
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { success: true } } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: hubs[0] } });
  vi.mocked(api.delete).mockResolvedValue({ data: { success: true, data: { success: true } } });
}

function renderSection(overrides: Partial<React.ComponentProps<typeof HubsSection>> = {}) {
  const props: React.ComponentProps<typeof HubsSection> = {
    selectedHubId: 'hub-1',
    onSelectHub: vi.fn(),
    canManage: true,
    onViewConsolidated: vi.fn(),
    onViewTenants: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TestQueryProvider><HubsSection {...props} /></TestQueryProvider>) };
}

const hubList = () => within(screen.getByLabelText('Daftar hub'));

describe('HubsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('lists hubs with their status and loads the selected hub profile', async () => {
    renderSection();

    expect(await hubList().findByText('BCA Hospitality')).toBeInTheDocument();
    expect(hubList().getByText('Maju Grup')).toBeInTheDocument();
    expect(hubList().getByText('Aktif')).toBeInTheDocument();
    expect(hubList().getByText('Nonaktif')).toBeInTheDocument();

    expect(await screen.findByDisplayValue('BCA Hospitality')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 tenant · 1 anggota/)).toBeInTheDocument());
  });

  it('filters the hub list by search term', async () => {
    renderSection();

    await userEvent.type(await screen.findByPlaceholderText('Cari hub...'), 'maju');

    await waitFor(() => {
      expect(hubList().queryByText('BCA Hospitality')).not.toBeInTheDocument();
    });
    expect(hubList().getByText('Maju Grup')).toBeInTheDocument();
  });

  it('hides management actions when the platform user lacks hub:manage', async () => {
    renderSection({ canManage: false });

    expect(await hubList().findByText('BCA Hospitality')).toBeInTheDocument();
    expect(screen.queryByText('+ Buat Hub')).not.toBeInTheDocument();
    expect(screen.queryByText('Simpan Perubahan')).not.toBeInTheDocument();
    expect(screen.queryByText('Hapus Hub')).not.toBeInTheDocument();
  });

  it('saves hub profile changes through the update mutation', async () => {
    renderSection();

    const nameInput = await screen.findByDisplayValue('BCA Hospitality');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'BCA Grup');
    await userEvent.click(screen.getByText('Simpan Perubahan'));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/hubs/hub-1', {
        name: 'BCA Grup',
        description: 'Grup ritel',
        isActive: true,
      }),
    );
  });

  it('assigns a tenant from the Tenant sub-tab', async () => {
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /Tenant/ }));
    await userEvent.click(screen.getByText('+ Assign Tenant ke Hub'));

    const dialog = await screen.findByRole('dialog', { name: 'Assign Tenant ke BCA Hospitality' });
    expect(within(dialog).getByText('Kopi Bali')).toBeInTheDocument();
    expect(within(dialog).getByText('Sudah di hub ini')).toBeInTheDocument();
    expect(within(dialog).getByText('Maju Grup')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByText('Pindahkan ke sini'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/hubs/hub-1/tenants/tenant-2'));
  });

  it('unassigns a tenant from the hub after confirmation', async () => {
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /Tenant/ }));
    await userEvent.click(screen.getByText('Lepas'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/hubs/hub-1/tenants/tenant-1'));
  });

  it('adds a member from one cross-tenant search column instead of a raw user id input', async () => {
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));
    expect(screen.getByText('Budi')).toBeInTheDocument();

    await userEvent.click(screen.getByText('+ Tambah Anggota'));
    const dialog = await screen.findByRole('dialog', { name: 'Tambah Anggota BCA Hospitality' });

    // No tenant picker, no user id input: one search across every tenant.
    expect(within(dialog).queryByLabelText('1. Tenant asal user')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('2. User')).not.toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/platform/users?hubId=hub-1')));

    // Rows carry the tenant name; existing members are locked.
    expect(within(dialog).getByText('Kopi Bali')).toBeInTheDocument();
    expect(within(dialog).getByText('Roti Manis')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Budi/).closest('label')).toHaveTextContent('Sudah anggota');
    expect(within(dialog).getByLabelText(/Budi/)).toBeDisabled();

    await userEvent.click(within(dialog).getByLabelText(/Sari/));
    await userEvent.click(within(dialog).getByText('Tambah Anggota'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/hub-memberships', {
        hubId: 'hub-1',
        userId: 'u2',
        role: 'admin',
      }),
    );
  });

  it('surfaces the home tenant name of each hub member', async () => {
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));
    await waitFor(() => expect(screen.getByText('Alpha Kopi')).toBeInTheDocument());
  });

  it('deep-links hub and member panels into the audit tab with a preset action filter', async () => {
    const onViewAudit = vi.fn();
    renderSection({ onViewAudit });

    await userEvent.click(await screen.findByRole('button', { name: /Tenant/ }));
    await userEvent.click(screen.getByText('Lihat di Audit'));
    expect(onViewAudit).toHaveBeenCalledWith('TENANT_ASSIGNED_TO_HUB');

    await userEvent.click(screen.getByRole('button', { name: /Anggota/ }));
    await userEvent.click(await screen.findByText('Lihat di Audit'));
    expect(onViewAudit).toHaveBeenCalledWith('MEMBER_ADDED');
  });

  it('confirms before removing a hub member', async () => {
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));
    await userEvent.click(await screen.findByText('Hapus'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/hub-memberships/hub-1/u1'));
  });
});
