import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HubCenterPage from '../../src/core/hub/pages/HubCenterPage';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
  },
}));

import { api } from '../../src/@shared/services/api';

const OWNER = { id: 'u-owner', role: 'owner', permissions: ['hub.read', 'hub.tenants.read', 'hub.members.read', 'hub.members.manage', 'hub.reports.read'] };
const VIEWER = { id: 'u-viewer', role: 'viewer', permissions: ['hub.read'] };

function hubRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hub-1',
    code: 'HUB-1',
    name: 'Hub Nusantara',
    description: null,
    status: 'active',
    role: OWNER.role,
    roleLabel: 'Owner',
    permissions: OWNER.permissions,
    ...overrides,
  };
}

const MEMBERS = [
  {
    id: 'm-1',
    hubId: 'hub-1',
    userId: 'u-owner',
    role: 'owner',
    status: 'active',
    suspendedAt: null,
    displayName: 'Budi Owner',
    email: 'budi@alpha.test',
    userTenantId: 't-1',
    userTenantName: 'Tenant Alpha',
  },
  {
    id: 'm-2',
    hubId: 'hub-1',
    userId: 'u-staff',
    role: 'viewer',
    status: 'suspended',
    suspendedAt: '2026-10-01',
    displayName: 'Siti Viewer',
    email: 'siti@beta.test',
    userTenantId: 't-2',
    userTenantName: 'Tenant Beta',
  },
];

const OVERVIEW = {
  hub: { id: 'hub-1', code: 'HUB-1', name: 'Hub Nusantara' },
  dateFrom: '2026-09-05',
  dateTo: '2026-10-05',
  generatedAt: '2026-10-05T00:00:00.000Z',
  counts: { tenants: 1, outlets: 1, activeOutlets: 1, members: 2 },
  operational: {
    staleHours: 12,
    outletsWithOpenShift: 1,
    outletsStale: 0,
    outletsWithoutShift: 0,
    outlets: [
      {
        outletId: 'o-1',
        outletName: 'Outlet Utama',
        tenantId: 't-1',
        tenantName: 'Tenant Alpha',
        isActive: true,
        openShifts: 1,
        lastShiftAt: '2026-10-05T09:00:00.000Z',
        hasOpenShift: true,
        isStale: false,
        idleHours: 1,
      },
    ],
  },
  sales: { currency: 'IDR', total: 1_500_000, transactions: 12, byTenant: [] },
  subscription: [],
};

function mockHubApi(row = hubRow()) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/hub/me/hubs') {
      return Promise.resolve({ data: { success: true, data: [row] } });
    }
    if (url === '/hub/hub-1') {
      return Promise.resolve({
        data: {
          success: true,
          data: { id: 'hub-1', code: 'HUB-1', name: 'Hub Nusantara', description: null, status: 'active' },
        },
      });
    }
    if (url === '/hub/hub-1/members') {
      return Promise.resolve({ data: { success: true, data: MEMBERS } });
    }
    if (url.startsWith('/hub/hub-1/members/')) {
      return Promise.resolve({ data: { success: true, data: [] } });
    }
    if (url === '/hub/hub-1/tenants') {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: 't-1',
              name: 'Tenant Alpha',
              status: 'active',
              businessType: 'Retail',
              businessCategory: null,
              address: 'Jl. Merdeka',
              phone: '0800',
              subscriptionExpiresAt: '2027-01-01T00:00:00.000Z',
            },
          ],
        },
      });
    }
    if (url.startsWith('/hub/hub-1/invitations')) {
      return Promise.resolve({ data: { success: true, data: [] } });
    }
    if (url.startsWith('/hub/hub-1/overview')) {
      return Promise.resolve({ data: { success: true, data: OVERVIEW } });
    }
    return Promise.resolve({ data: { success: true, data: {} } });
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TestQueryProvider>
        <HubCenterPage />
      </TestQueryProvider>
    </MemoryRouter>,
  );
}

describe('HubCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: { id: OWNER.id, email: 'budi@alpha.test', displayName: 'Budi Owner', tenantId: 't-1' },
    } as never);
    mockHubApi();
  });

  it('merender hub, kode, role, dan tab sesuai izin', async () => {
    renderPage();

    expect(await screen.findByText('Hub Nusantara')).toBeInTheDocument();
    expect(screen.getByText('HUB-1')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Anggota')).toBeInTheDocument();
    expect(screen.getByText('Undangan')).toBeInTheDocument();
  });

  it('hanya tab yang diizinkan yang muncul untuk viewer', async () => {
    mockHubApi(hubRow({ role: VIEWER.role, roleLabel: 'Viewer', permissions: VIEWER.permissions }));
    renderPage();

    expect(await screen.findByText('Hub Nusantara')).toBeInTheDocument();
    // `hub.read` alone: nothing but the profile.
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Tenant')).not.toBeInTheDocument();
    expect(screen.queryByText('Anggota')).not.toBeInTheDocument();
    expect(screen.getByText(/belum memiliki izin/i)).toBeInTheDocument();
  });

  it('tab tersembunyi tidak menembak endpoint-nya', async () => {
    mockHubApi(hubRow({ role: VIEWER.role, roleLabel: 'Viewer', permissions: VIEWER.permissions }));
    renderPage();

    await screen.findByText('Hub Nusantara');
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(0));
    const urls = vi.mocked(api.get).mock.calls.map((c) => c[0]);
    expect(urls.some((u) => String(u).includes('/overview'))).toBe(false);
    expect(urls.some((u) => String(u).includes('/members'))).toBe(false);
    expect(urls.some((u) => String(u).includes('/invitations'))).toBe(false);
  });

  it('tab Anggota menampilkan anggota dan menandai yang ditangguhkan', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Anggota'));

    expect(await screen.findByText('Siti Viewer')).toBeInTheDocument();
    expect(screen.getByText('Ditangguhkan')).toBeInTheDocument();
    expect(screen.getByText('Tenant Beta')).toBeInTheDocument();
  });

  it('owner tidak dapat mengubah role-nya sendiri', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Anggota'));

    await screen.findByText('Siti Viewer');
    // The owner row renders a badge, never a select: nothing ranks above owner.
    expect(screen.queryByLabelText('Role hub untuk Budi Owner')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Role hub untuk Siti Viewer')).toBeInTheDocument();
  });

  it('viewer tidak melihat aksi mutasi di tab Anggota', async () => {
    mockHubApi(
      hubRow({ role: 'viewer', roleLabel: 'Viewer', permissions: ['hub.read', 'hub.members.read'] }),
    );
    renderPage();
    await userEvent.click(await screen.findByText('Anggota'));

    await screen.findByText('Siti Viewer');
    expect(screen.queryByRole('button', { name: '+ Tambah anggota' })).not.toBeInTheDocument();
  });

  it('menampilkan chain: role select → mutasi ubah role', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    renderPage();
    await userEvent.click(await screen.findByText('Anggota'));
    await screen.findByText('Siti Viewer');

    await userEvent.selectOptions(
      screen.getByLabelText('Role hub untuk Siti Viewer'),
      'manager',
    );

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/hub/hub-1/members/u-staff', { role: 'manager' }),
    );
  });

  it('tab Tenant menampilkan daftar read-only', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Tenant'));

    expect(await screen.findByText('Tenant Alpha')).toBeInTheDocument();
    expect(screen.getByText('Jl. Merdeka')).toBeInTheDocument();
  });

  it('menyimpan hub terpilih di localStorage untuk sesi berikutnya', async () => {
    renderPage();
    await screen.findByText('Hub Nusantara');

    expect(localStorage.getItem('posmono.activeHubId')).toBe('hub-1');
  });

  it('menampilkan peringatan bila hub tidak aktif', async () => {
    mockHubApi(hubRow({ status: 'suspended' }));
    renderPage();

    expect(await screen.findByText(/berstatus suspended/i)).toBeInTheDocument();
  });

  it('kosong pada akun tanpa keanggotaan hub', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: [] } });
    renderPage();

    expect(await screen.findByText(/belum menjadi anggota hub/i)).toBeInTheDocument();
  });
});
