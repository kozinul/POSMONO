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
  {
    id: 'hub-1',
    name: 'BCA Hospitality',
    description: 'Grup ritel',
    code: 'BCA-HOSPITALITY',
    status: 'active' as const,
    isActive: true,
    ownerUserId: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  },
  {
    id: 'hub-2',
    name: 'Maju Grup',
    description: null,
    code: 'MAJU-GRUP',
    status: 'suspended' as const,
    isActive: false,
    ownerUserId: null,
    createdAt: '2026-09-02',
    updatedAt: '2026-09-02',
  },
  {
    id: 'hub-3',
    name: 'Bali Legacy',
    description: 'Sudah ditutup',
    code: 'BALI-LEGACY',
    status: 'archived' as const,
    isActive: false,
    ownerUserId: null,
    createdAt: '2026-09-03',
    updatedAt: '2026-09-03',
  },
];

const hubDetail = {
  ...hubs[0],
  tenants: [{ id: 'tenant-1', name: 'Kopi Bali', slug: 'kopi-bali', businessType: 'cafe', status: 'active', plan: 'Pro', hubId: 'hub-1' }],
  tenantCount: 1,
  owner: null,
};

const archivedHubDetail = {
  ...hubs[2],
  tenants: hubDetail.tenants,
  tenantCount: 1,
  owner: null,
};

const members = [
  { id: 'm1', hubId: 'hub-1', userId: 'u1', role: 'owner' as const, displayName: 'Budi', email: 'budi@kopi.id', userTenantId: 'tenant-1', userTenantName: 'Alpha Kopi', createdAt: '', updatedAt: '' },
];

const invitations = [
  {
    id: 'i1',
    hubId: 'hub-1',
    email: 'budi@kopi.id',
    role: 'manager' as const,
    roleLabel: 'Manager',
    status: 'pending' as const,
    isExpired: false,
    acceptedBy: null,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    invitedBy: 'platform-admin',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'i2',
    hubId: 'hub-1',
    email: 'lama@kopi.id',
    role: 'viewer' as const,
    roleLabel: 'Viewer',
    status: 'expired' as const,
    isExpired: true,
    acceptedBy: null,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: '2026-01-01T00:00:00.000Z',
    invitedBy: 'platform-admin',
    createdAt: '',
    updatedAt: '',
  },
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

const hubOverview = {
  hub: hubs[0],
  dateFrom: '2026-09-01T00:00:00.000Z',
  dateTo: '2026-09-30T23:59:59.999Z',
  generatedAt: '2026-09-30T10:00:00.000Z',
  counts: { tenants: 2, outlets: 3, activeOutlets: 2, members: 2 },
  operational: {
    staleHours: 24,
    outletsWithOpenShift: 1,
    outletsStale: 1,
    outletsWithoutShift: 1,
    outlets: [
      {
        outletId: 'outlet-1',
        outletName: 'Sanur',
        tenantId: 'tenant-1',
        tenantName: 'Kopi Bali',
        isActive: true,
        openShifts: 1,
        lastShiftAt: '2026-09-30T09:00:00.000Z',
        hasOpenShift: true,
        isStale: false,
        idleHours: 1,
      },
      {
        outletId: 'outlet-3',
        outletName: 'Kemang',
        tenantId: 'tenant-2',
        tenantName: 'Roti Manis',
        isActive: true,
        openShifts: 0,
        lastShiftAt: null,
        hasOpenShift: false,
        isStale: true,
        idleHours: null,
      },
    ],
  },
  sales: {
    currency: 'IDR',
    total: 1_400_000,
    transactions: 14,
    byTenant: [
      { tenantId: 'tenant-1', tenantName: 'Kopi Bali', total: 1_000_000, transactions: 10 },
      { tenantId: 'tenant-2', tenantName: 'Roti Manis', total: 400_000, transactions: 4 },
    ],
  },
  subscription: [
    { tenantId: 'tenant-1', tenantName: 'Kopi Bali', planName: 'Pro', status: 'active', daysRemaining: 12 },
  ],
};

function tenantPage(rows: unknown[]) {
  return Promise.resolve({
    data: { success: true, data: { data: rows, total: rows.length, page: 1, limit: 20 } },
  });
}

function mockApi(usersSummary?: unknown[], detail = hubDetail, memberRows = members) {
  const byId: Record<string, typeof hubDetail> = { 'hub-1': hubDetail, 'hub-3': archivedHubDetail };
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/platform/hubs') return Promise.resolve({ data: { success: true, data: hubs } });
    const detailMatch = url.match(/^\/platform\/hubs\/(hub-\d+)$/);
    if (detailMatch) {
      // The test picks which hub is being viewed by passing its detail in.
      const row = byId[detailMatch[1]] ?? detail;
      return Promise.resolve({ data: { success: true, data: usersSummary ? { ...row, usersSummary } : row } });
    }
    if (/^\/hub-memberships\/hub\/hub-\d+$/.test(url)) {
      return Promise.resolve({ data: { success: true, data: memberRows } });
    }
    if (/^\/hubs\/hub-\d+\/invitations$/.test(url)) {
      return Promise.resolve({ data: { success: true, data: invitations } });
    }
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
    if (url.startsWith('/platform/hubs/hub-')) return Promise.resolve({ data: { success: true, data: hubOverview } });
    if (url.startsWith('/platform/tenants?')) return tenantPage([hubDetail.tenants[0], otherTenant]);
    if (url === '/platform/tenants') return tenantPage([hubDetail.tenants[0]]);
    return Promise.resolve({ data: { success: true, data: [] } });
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { success: true } } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: hubs[0] } });
  vi.mocked(api.delete).mockResolvedValue({ data: { success: true, data: { success: true } } });
}

function renderSection(
  overrides: Partial<React.ComponentProps<typeof HubsSection>> = {},
  detail = hubDetail,
  memberRows = members,
) {
  const props: React.ComponentProps<typeof HubsSection> = {
    selectedHubId: 'hub-1',
    onSelectHub: vi.fn(),
    canManage: true,
    canViewReports: true,
    onViewConsolidated: vi.fn(),
    onViewTenants: vi.fn(),
    ...overrides,
  };
  mockApi(undefined, detail, memberRows);
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
    expect(hubList().getByText('Ditangguhkan')).toBeInTheDocument();
    expect(hubList().getByText('Diarsipkan')).toBeInTheDocument();

    // The unique code is a first-class part of the row, not derived on screen.
    expect(hubList().getByText('BCA-HOSPITALITY')).toBeInTheDocument();

    expect(await screen.findByDisplayValue('BCA Hospitality')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('BCA-HOSPITALITY')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 tenant · 1 anggota/)).toBeInTheDocument());
  });

  it('searches hubs by code, not only by name', async () => {
    renderSection();

    await userEvent.type(await screen.findByPlaceholderText(/Cari nama atau kode hub/), 'bali-leg');

    await waitFor(() => {
      expect(hubList().queryByText('BCA Hospitality')).not.toBeInTheDocument();
    });
    expect(hubList().getByText('Bali Legacy')).toBeInTheDocument();
  });

  it('filters the hub list by search term', async () => {
    renderSection();

    await userEvent.type(await screen.findByPlaceholderText(/Cari nama atau kode hub/), 'maju');

    await waitFor(() => {
      expect(hubList().queryByText('BCA Hospitality')).not.toBeInTheDocument();
    });
    expect(hubList().getByText('Maju Grup')).toBeInTheDocument();
  });

  it('hides management actions when the platform user lacks platform.hubs.manage', async () => {
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
        code: 'BCA-HOSPITALITY',
        status: 'active',
      }),
    );
    // Regression: `isActive` is a derived mirror. Sending it was a silent no-op
    // that still reported success, so it must never appear in the payload.
    expect(JSON.stringify(vi.mocked(api.put).mock.calls[0])).not.toContain('isActive');
  });

  it('sends status — not the derived isActive — when suspending a hub', async () => {
    renderSection();

    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'suspended');
    await userEvent.click(screen.getByText('Simpan Perubahan'));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/hubs/hub-1', {
        name: 'BCA Hospitality',
        description: 'Grup ritel',
        code: 'BCA-HOSPITALITY',
        status: 'suspended',
      }),
    );
  });

  it('shows the owner, falling back to the hub owner-role member when ownerUserId is unset', async () => {
    renderSection();

    // hubDetail.owner is null, so Budi (role owner) is the fallback.
    await waitFor(() => expect(screen.getByText(/Pemilik Hub:/)).toBeInTheDocument());
    expect(screen.getByText('Budi')).toBeInTheDocument();
  });

  it('locks an archived hub: read-only notice, frozen fields, and no tenant/member mutations', async () => {
    renderSection({ selectedHubId: 'hub-3' }, archivedHubDetail);

    await waitFor(() => expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0));

    expect(screen.getByLabelText('Nama Hub *')).toBeDisabled();
    expect(screen.getByLabelText('Kode Hub *')).toBeDisabled();
    expect(screen.getByLabelText('Deskripsi')).toBeDisabled();
    // The status itself must stay editable — that is the only way back.
    expect(screen.getByLabelText('Status')).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /Tenant/ }));
    expect(screen.getByRole('button', { name: '+ Assign Tenant ke Hub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lepas' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /Anggota/ }));
    expect(screen.getByRole('button', { name: '+ Tambah Anggota' })).toBeDisabled();
    // Query by role: the explainer copy also mentions the word "Akses".
    expect(screen.getByRole('button', { name: 'Akses' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeDisabled();
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

  // ------------------------------------------------ Hub V2 Fase 20 — suspend

  describe('suspensi anggota (Hub V2 Fase 20)', () => {
    const suspendedMember = {
      ...members[0],
      id: 'm9',
      userId: 'u9',
      email: 'sari@kopi.id',
      displayName: 'Sari',
      status: 'suspended' as const,
      suspendedAt: '2026-10-01T00:00:00.000Z',
    };

    it('sends an explicit status, and keeps suspend and reactivate distinct', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));
      await userEvent.click(await screen.findByText('Tangguhkan'));
      await waitFor(() =>
        expect(api.put).toHaveBeenCalledWith('/hub-memberships/hub-1/u1/status', {
          status: 'suspended',
        }),
      );

      // Suspending is not "removing": no delete is issued behind the scenes.
      expect(api.delete).not.toHaveBeenCalled();
    });

    it('shows a suspended member with its status and offers to restore it', async () => {
      renderSection({}, hubDetail, [suspendedMember]);

      await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));

      // Scoped to the member table: the hub list itself has a "Ditangguhkan"
      // badge for the suspended hub, which is a different fact entirely.
      const memberTable = await screen.findByRole('table');
      await waitFor(() => expect(within(memberTable).getByText('Ditangguhkan')).toBeInTheDocument());
      expect(within(memberTable).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Aktifkan' }));
      await waitFor(() =>
        expect(api.put).toHaveBeenCalledWith('/hub-memberships/hub-1/u9/status', { status: 'active' }),
      );
    });

    it('treats a member row without a status as active (pre-Fase-20 rows)', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));

      // The fixture has no `status` field at all; the badge must not be blank.
      const memberTable = await screen.findByRole('table');
      await waitFor(() => expect(within(memberTable).getByText('Aktif')).toBeInTheDocument());
    });

    it('locks status changes on an archived hub', async () => {
      renderSection({ selectedHubId: 'hub-3' }, archivedHubDetail, [suspendedMember]);

      await userEvent.click(await screen.findByRole('button', { name: /Anggota/ }));
      expect(await screen.findByRole('button', { name: 'Aktifkan' })).toBeDisabled();
    });
  });

  // ------------------------------------------ Hub V2 Fase 20 — invitations

  describe('Undangan sub-tab (Hub V2 Fase 20)', () => {
    it('lists invitations with their status from the hub-scoped endpoint', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: 'Undangan' }));

      expect(await screen.findByText('budi@kopi.id')).toBeInTheDocument();
      expect(screen.getByText('lama@kopi.id')).toBeInTheDocument();
      expect(screen.getByText('Menunggu')).toBeInTheDocument();
      expect(screen.getByText('Kedaluwarsa')).toBeInTheDocument();
      // Only a pending invitation can be revoked.
      expect(screen.getAllByRole('button', { name: 'Cabut' })).toHaveLength(1);

      expect(vi.mocked(api.get).mock.calls.some((c) => String(c[0]) === '/hubs/hub-1/invitations')).toBe(true);
    });

    it('creates an invitation and shows the raw link exactly once', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            invitation: { ...invitations[0], email: 'baru@kopi.id' },
            token: 'rahasia-token-123',
          },
        },
      } as never);
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: 'Undangan' }));
      await userEvent.type(await screen.findByLabelText('Email tujuan'), 'baru@kopi.id');
      await userEvent.click(screen.getByRole('button', { name: 'Buat Undangan' }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/hubs/hub-1/invitations', {
          email: 'baru@kopi.id',
          role: 'viewer',
          expiresInHours: 24 * 7,
        }),
      );

      // The one thing the admin cannot get back: the link is shown once, with an
      // explicit warning that it will not be retrievable.
      expect(await screen.findByText(/hanya ditampilkan sekali/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Salin Tautan' })).toBeInTheDocument();
    });

    it('revokes a pending invitation', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: 'Undangan' }));
      await userEvent.click(await screen.findByText('Cabut'));

      await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/hubs/hub-1/invitations/i1'));
    });

    it('hides the form and the actions without platform.hubs.manage', async () => {
      renderSection({ canManage: false });

      await userEvent.click(await screen.findByRole('button', { name: 'Undangan' }));

      // Read-only: the list is still useful, but nothing may be issued or revoked.
      expect(await screen.findByText('budi@kopi.id')).toBeInTheDocument();
      expect(screen.queryByLabelText('Email tujuan')).not.toBeInTheDocument();
      expect(screen.queryByText('Cabut')).not.toBeInTheDocument();
    });

    it('freezes invitations on an archived hub', async () => {
      renderSection({ selectedHubId: 'hub-3' }, archivedHubDetail);

      await userEvent.click(await screen.findByRole('button', { name: 'Undangan' }));

      expect(await screen.findByText(/Hub diarsipkan/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Email tujuan')).not.toBeInTheDocument();
    });
  });

  describe('Overview sub-tab (Hub V2 Fase 19)', () => {
    it('shows counts, sales per tenant and subscription rollup', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: /Overview/ }));

      expect(await screen.findByText('Status Outlet')).toBeInTheDocument();
      expect(screen.getByText('2 / 3')).toBeInTheDocument(); // aktif / total outlet
      expect(screen.getByText('Rp 1.400.000')).toBeInTheDocument();
      // Every tenant of the hub gets a sales row, not only the ones that sold.
      expect(screen.getByText('Rp 1.000.000')).toBeInTheDocument();
      expect(screen.getByText('Rp 400.000')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument(); // sisa hari langganan
    });

    it('calls the hub-scoped overview endpoint for the selected hub only', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: /Overview/ }));

      await waitFor(() =>
        expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/platform/hubs/hub-1/overview')),
      );
      const overviewCalls = vi.mocked(api.get).mock.calls.filter((c) => String(c[0]).includes('/overview'));
      expect(overviewCalls).toHaveLength(1);
    });

    it('flags an outlet that never opened a shift instead of hiding it', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: /Overview/ }));

      expect(await screen.findByText('Kemang')).toBeInTheDocument();
      expect(screen.getByText('perhatian')).toBeInTheDocument();
      expect(screen.getByText(/1 outlet tidak punya shift buka/)).toBeInTheDocument();
      expect(screen.getByText('belum pernah')).toBeInTheDocument();
    });

    it('hides the sub-tab without platform.reports.read and never fetches it', async () => {
      renderSection({ canViewReports: false });

      await hubList().findByText('BCA Hospitality');
      expect(screen.queryByRole('button', { name: /Overview/ })).not.toBeInTheDocument();
      expect(vi.mocked(api.get).mock.calls.some((c) => String(c[0]).includes('/overview'))).toBe(false);
    });

    it('re-queries with an explicit date range when the preset changes', async () => {
      renderSection();

      await userEvent.click(await screen.findByRole('button', { name: /Overview/ }));
      await screen.findByText('Status Outlet');
      vi.mocked(api.get).mockClear();

      await userEvent.click(screen.getByRole('button', { name: '7 hari' }));

      await waitFor(() => {
        const call = vi.mocked(api.get).mock.calls.find((c) => String(c[0]).includes('/overview'));
        expect(String(call?.[0])).toContain('dateFrom=');
        expect(String(call?.[0])).toContain('dateTo=');
      });
    });
  });
});
