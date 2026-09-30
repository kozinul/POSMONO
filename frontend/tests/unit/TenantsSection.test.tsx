import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TenantsSection from '../../src/core/platform/sections/TenantsSection';
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

import Swal from 'sweetalert2';
import { api } from '../../src/@shared/services/api';

const tenants = [
  {
    id: 'tenant-1',
    name: 'Kopi Bali',
    slug: 'kopi-bali',
    businessType: 'cafe',
    status: 'active',
    plan: 'Pro',
    hubId: 'hub-1',
    hubName: 'BCA Hospitality',
  },
  {
    id: 'tenant-2',
    name: 'Roti Manis',
    slug: 'roti-manis',
    businessType: 'bakery',
    status: 'frozen',
    plan: 'Trial',
    hubId: null,
    hubName: null,
  },
];

function tenantPage(rows: unknown[], total = rows.length) {
  return Promise.resolve({
    data: { success: true, data: { data: rows, total, page: 1, limit: 20 } },
  });
}

function mockApi(rows: unknown[] = tenants, total?: number) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/platform/tenants')) return tenantPage(rows, total);
    return Promise.resolve({ data: { success: true, data: [] } });
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { success: true } } });
  vi.mocked(api.delete).mockResolvedValue({
    data: { success: true, data: { deleted: 4, totalDeleted: 4 } },
  });
}

function renderSection(overrides: Partial<React.ComponentProps<typeof TenantsSection>> = {}) {
  const props: React.ComponentProps<typeof TenantsSection> = {
    hubFilter: null,
    onClearHubFilter: vi.fn(),
    ...overrides,
  };
  return {
    props,
    ...render(
      <TestQueryProvider>
        <MemoryRouter>
          <TenantsSection {...props} />
        </MemoryRouter>
      </TestQueryProvider>,
    ),
  };
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;
const action = async (name: string, label: string) => within(await rowOf(name)).getByText(label);

describe('TenantsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks tidak mengembalikan implementation, jadi default dialog
    // dipasang ulang tiap test agar override satu test tidak bocor ke berikutnya.
    vi.mocked(Swal.fire).mockImplementation(async (options: Record<string, unknown> = {}) => {
      const preConfirm = options.preConfirm as ((value: string) => Promise<boolean>) | undefined;
      if (preConfirm) {
        const inputType = options.input as string | undefined;
        const ok = await preConfirm(inputType === 'number' ? '30' : 'alasan test');
        if (!ok) return { isConfirmed: false };
      }
      return { isConfirmed: true, value: 'alasan test' };
    });
    mockApi();
  });

  it('lists tenants with hub, status and plan columns', async () => {
    renderSection();

    expect(await screen.findByText('Kopi Bali')).toBeInTheDocument();
    expect(screen.getByText('kopi-bali')).toBeInTheDocument();
    expect(screen.getByText('BCA Hospitality')).toBeInTheDocument();
    expect(screen.getByText('Standalone')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('frozen')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText(/Tenants \(2\)/)).toBeInTheDocument();
  });

  it('freezes an active tenant after confirmation and re-activates a frozen one', async () => {
    renderSection();

    await userEvent.click(await action('Kopi Bali', 'Freeze'));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/platform/tenants/tenant-1/status', {
        status: 'frozen',
        reason: undefined,
      }),
    );

    await userEvent.click(await action('Roti Manis', 'Activate'));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/platform/tenants/tenant-2/status', {
        status: 'active',
        reason: undefined,
      }),
    );
  });

  it('suspends a tenant with the reason typed in the dialog', async () => {
    renderSection();

    await userEvent.click(await action('Kopi Bali', 'Suspend'));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/platform/tenants/tenant-1/status', {
        status: 'suspended',
        reason: 'alasan test',
      }),
    );
  });

  it('does not suspend when the dialog preConfirm rejects the empty reason', async () => {
    vi.mocked(Swal.fire).mockImplementation(async (options: Record<string, unknown> = {}) => {
      const preConfirm = options.preConfirm as ((value: string) => Promise<boolean>) | undefined;
      if (preConfirm) {
        const ok = await preConfirm('');
        if (!ok) return { isConfirmed: false };
      }
      return { isConfirmed: true, value: '' };
    });

    renderSection();

    await userEvent.click(await action('Kopi Bali', 'Suspend'));

    await waitFor(() => expect(Swal.showValidationMessage).toHaveBeenCalledWith('Alasan suspend wajib diisi.'));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('extends the subscription with the number of days from the dialog', async () => {
    renderSection();

    await userEvent.click(await action('Kopi Bali', '+ Extend'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/platform/tenants/tenant-1/extend', { days: 30 }));
  });

  it('deletes a tenant permanently with the typed reason', async () => {
    renderSection();

    await userEvent.click(await action('Kopi Bali', 'Hapus'));
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/platform/tenants/tenant-1', { data: { reason: 'alasan test' } }),
    );
  });

  it('scopes the list to a hub and clears the filter on request', async () => {
    const onClearHubFilter = vi.fn();
    renderSection({ hubFilter: { hubId: 'hub-1', hubName: 'BCA Hospitality' }, onClearHubFilter });

    expect(await screen.findByText('Filter hub: BCA Hospitality')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/platform/tenants?hubId=hub-1')),
    );

    await userEvent.click(screen.getByText('Hapus filter'));
    expect(onClearHubFilter).toHaveBeenCalled();
  });

  it('debounces the search term into the tenants query', async () => {
    renderSection();

    await userEvent.type(await screen.findByPlaceholderText('Cari tenant...'), 'kopi');

    await waitFor(
      () => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/platform/tenants?search=kopi')),
      { timeout: 2000 },
    );
  });

  it('paginates when the total exceeds the page limit', async () => {
    mockApi(tenants, 42);
    renderSection();

    expect(await screen.findByText('Halaman 1 dari 3')).toBeInTheDocument();
    expect(screen.getByText('Prev')).toBeDisabled();
  });

  it('hides the pager when everything fits on one page', async () => {
    mockApi(tenants, 2);
    renderSection();

    expect(await screen.findByText('Kopi Bali')).toBeInTheDocument();
    expect(screen.queryByText(/Halaman 1 dari/)).not.toBeInTheDocument();
  });
});
