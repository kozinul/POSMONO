import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HubMemberAccessModal from '../../src/core/platform/components/HubMemberAccessModal';
import {
  TENANT_ACCESS_ROLES,
  TENANT_ACCESS_ROLE_LABELS,
  TENANT_ACCESS_ROLE_HINTS,
  useHubMemberAccess,
  useSaveHubMemberAccess,
  useRevokeHubMemberAccess,
  useHubContext,
  type HubMemberAccessGrant,
} from '../../src/@shared/hooks/useHubMemberships';

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
    post: (...args: unknown[]) => apiPut(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

const TENANTS = [
  { id: 'tenant-a', name: 'Alpha Kopi' },
  { id: 'tenant-b', name: 'Beta Resto' },
];

const OUTLETS = [
  { id: 'outlet-a1', tenantId: 'tenant-a', tenantName: 'Alpha Kopi', name: 'Outlet Alpha 1', address: null, phone: null, isActive: true },
  { id: 'outlet-a2', tenantId: 'tenant-a', tenantName: 'Alpha Kopi', name: 'Outlet Alpha 2', address: null, phone: null, isActive: true },
  { id: 'outlet-b1', tenantId: 'tenant-b', tenantName: 'Beta Resto', name: 'Outlet Beta 1', address: null, phone: null, isActive: true },
];

function grant(overrides: Partial<HubMemberAccessGrant> = {}): HubMemberAccessGrant {
  return {
    id: `g-${overrides.tenantId ?? 'tenant-a'}`,
    hubId: 'hub-1',
    userId: 'user-1',
    tenantId: 'tenant-a',
    tenantRole: 'viewer',
    outletIds: [],
    status: 'active',
    tenantRoleLabel: 'Viewer',
    allOutlets: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderModal(props: Partial<Parameters<typeof HubMemberAccessModal>[0]> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HubMemberAccessModal
        isOpen
        onClose={() => {}}
        hubId="hub-1"
        hubName="Group One"
        userId="user-1"
        memberName="Budi"
        tenants={TENANTS}
        canManage
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((url: string) => {
    if (url.includes('/access')) return Promise.resolve({ data: { success: true, data: [] } });
    if (url.includes('/outlets')) return Promise.resolve({ data: { success: true, data: OUTLETS } });
    if (url.includes('/hub-context/me'))
      return Promise.resolve({ data: { success: true, data: { hubs: [], grants: [], tenants: [], effectivePermissions: [] } } });
    return Promise.resolve({ data: { success: true, data: [] } });
  });
  apiPut.mockResolvedValue({ data: { success: true, data: {} } });
  apiDelete.mockResolvedValue({ data: { success: true } });
});

describe('Hub V2 Fase 17 — tenant access role contract (frontend)', () => {
  it('offers the five tenant roles, including cashier, with label + hint', () => {
    expect(TENANT_ACCESS_ROLES).toEqual(['owner', 'admin', 'manager', 'cashier', 'viewer']);
    for (const role of TENANT_ACCESS_ROLES) {
      expect(TENANT_ACCESS_ROLE_LABELS[role]).toBeTruthy();
      expect(TENANT_ACCESS_ROLE_HINTS[role]).toBeTruthy();
    }
  });
});

describe('HubMemberAccessModal', () => {
  it('warns that a member with no grants still follows the hub role', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByText(/mengikuti/i)).toBeTruthy(),
    );
    expect(screen.getByText(/seluruh tenant dalam hub/i)).toBeTruthy();
  });

  it('hides the fallback warning once an explicit grant exists', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/access'))
        return Promise.resolve({ data: { success: true, data: [grant({ tenantRole: 'manager' })] } });
      if (url.includes('/outlets')) return Promise.resolve({ data: { success: true, data: OUTLETS } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderModal();
    await waitFor(() => expect(screen.getByDisplayValue('Manager')).toBeTruthy());
    expect(screen.queryByText(/mengikuti/i)).toBeNull();
  });

  it('sends an upsert with the selected role and the narrowed outlet list', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/access'))
        return Promise.resolve({
          data: {
            success: true,
            data: [grant({ tenantId: 'tenant-a', tenantRole: 'viewer', outletIds: [], allOutlets: true })],
          },
        });
      if (url.includes('/outlets')) return Promise.resolve({ data: { success: true, data: OUTLETS } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText('Role untuk Alpha Kopi')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Role untuk Alpha Kopi'), { target: { value: 'manager' } });
    fireEvent.click(screen.getByLabelText('Pilih outlet'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Simpan' })[0]);

    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    const [url, body] = apiPut.mock.calls[0];
    expect(url).toBe('/hub-memberships/hub/hub-1/user-1/access');
    expect(body).toMatchObject({
      tenantId: 'tenant-a',
      tenantRole: 'manager',
      outletIds: ['outlet-a1'],
    });
  });

  it('sends an empty outlet list for "semua outlet"', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/access'))
        return Promise.resolve({
          data: {
            success: true,
            data: [grant({ tenantId: 'tenant-a', outletIds: ['outlet-a1'], allOutlets: false })],
          },
        });
      if (url.includes('/outlets')) return Promise.resolve({ data: { success: true, data: OUTLETS } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText('Role untuk Alpha Kopi')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Semua outlet'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Simpan' })[0]);

    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    expect(apiPut.mock.calls[0][1]).toMatchObject({ tenantId: 'tenant-a', outletIds: [] });
  });

  it('revokes instead of granting when a tenant is unchecked', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/access'))
        return Promise.resolve({
          data: {
            success: true,
            data: [grant({ tenantId: 'tenant-a', tenantRole: 'manager', outletIds: [], allOutlets: true })],
          },
        });
      if (url.includes('/outlets')) return Promise.resolve({ data: { success: true, data: OUTLETS } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText('Role untuk Alpha Kopi')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Alpha Kopi'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Simpan' })[0]);

    await waitFor(() => expect(apiDelete).toHaveBeenCalled());
    expect(apiDelete.mock.calls[0][0]).toBe('/hub-memberships/hub/hub-1/user-1/access/tenant-a');
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('keeps a suspended grant visible as "ditangguhkan" and re-enables it on save', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/access'))
        return Promise.resolve({
          data: {
            success: true,
            data: [grant({ tenantId: 'tenant-a', status: 'suspended', allOutlets: true })],
          },
        });
      if (url.includes('/outlets')) return Promise.resolve({ data: { success: true, data: OUTLETS } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderModal();
    await waitFor(() => expect(screen.getByText('Ditangguhkan')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Alpha Kopi'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Simpan' })[0]);

    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    // no `status` in the body → the backend revives it
    expect(apiPut.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('never queries the platform outlet list for a read-only viewer', async () => {
    renderModal({ canManage: false });
    await waitFor(() => expect(screen.getByText('Budi')).toBeTruthy());
    expect(apiGet.mock.calls.some(([url]: [string]) => url.includes('/outlets'))).toBe(false);
  });
});

describe('Fase 17 hooks', () => {
  function HookHarness() {
    useHubMemberAccess('hub-1', 'user-1');
    useHubContext();
    return <span>ready</span>;
  }

  it('reads the grant list and the member context from the documented paths', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <HookHarness />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    const urls = apiGet.mock.calls.map(([url]: [string]) => url);
    expect(urls).toContain('/hub-memberships/hub/hub-1/user-1/access');
    expect(urls).toContain('/hub-context/me');
  });

  it('is disabled without a userId', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    function Empty() {
      useHubMemberAccess('hub-1', null);
      return <span>x</span>;
    }

    render(
      <QueryClientProvider client={client}>
        <Empty />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('exposes the save/revoke mutations used by the modal', () => {
    expect(typeof useSaveHubMemberAccess).toBe('function');
    expect(typeof useRevokeHubMemberAccess).toBe('function');
  });
});
