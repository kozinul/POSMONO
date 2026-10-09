import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TenantInvoicesSection from '../../src/core/platform/components/TenantInvoicesSection';
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
        const ok = await preConfirm('alasan test');
        if (!ok) return { isConfirmed: false };
      }
      return { isConfirmed: true, value: 'alasan test' };
    }),
    showValidationMessage: vi.fn(),
  },
}));

import { api } from '../../src/@shared/services/api';

const pendingInvoice = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  subscriptionId: 'sub-1',
  number: 'INV-0001',
  status: 'pending' as const,
  amount: 199000,
  currency: 'IDR' as const,
  periodStart: '2026-10-01T00:00:00.000Z',
  periodEnd: '2026-10-31T00:00:00.000Z',
  dueDate: '2026-10-31T00:00:00.000Z',
  paidAt: null,
  lineItems: [{ description: 'Plan Starter', amount: 199000, quantity: 1, total: 199000 }],
  referenceType: 'renewal' as const,
  notes: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const paidInvoice = {
  ...pendingInvoice,
  id: 'inv-2',
  number: 'INV-0002',
  status: 'paid' as const,
  amount: 499000,
  paidAt: '2026-10-02T00:00:00.000Z',
  referenceType: 'plan_assigned' as const,
};

const attempts = [
  {
    id: 'pay-1',
    tenantId: 'tenant-1',
    invoiceId: 'inv-1',
    number: null,
    amount: 199000,
    method: 'transfer',
    status: 'completed' as const,
    gateway: { provider: 'manual', txId: 'TRF-889', vaNumber: null, qrUrl: null },
    actorEmail: 'admin@kuire.id',
    notes: null,
    startedAt: '2026-10-02T00:00:00.000Z',
    completedAt: '2026-10-02T00:00:00.000Z',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
  },
];

function mockApi(items: unknown[] = [pendingInvoice, paidInvoice]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/subscription/invoices/inv-1/payments')) {
      return Promise.resolve({ data: { success: true, data: { items: attempts } } });
    }
    if (url.includes('/subscription/invoices')) {
      return Promise.resolve({
        data: { success: true, data: { items, totals: { outstanding: 199000, paid: 499000 } } },
      });
    }
    return Promise.resolve({ data: { success: true, data: { items: [] } } });
  });
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: { invoice: { ...pendingInvoice, status: 'paid' }, attempt: attempts[0] } },
  });
}

function renderSection() {
  return render(
    <TestQueryProvider>
      <TenantInvoicesSection tenantId="tenant-1" />
    </TestQueryProvider>,
  );
}

const action = async (invoiceNumber: string, label: string) =>
  within((await screen.findByText(invoiceNumber)).closest('tr') as HTMLElement).getByText(label);

describe('TenantInvoicesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('lists invoices with totals, status and reference type', async () => {
    renderSection();

    expect(await screen.findByText('INV-0001')).toBeInTheDocument();
    expect(screen.getByText('INV-0002')).toBeInTheDocument();
    expect(screen.getByText('Belum Lunas')).toBeInTheDocument();
    expect(screen.getByText('Lunas')).toBeInTheDocument();
    expect(screen.getByText('Perpanjangan')).toBeInTheDocument();
    expect(screen.getByText('Assign Plan')).toBeInTheDocument();
    const pendingRow = (await screen.findByText('INV-0001')).closest('tr') as HTMLElement;
    const paidRow = screen.getByText('INV-0002').closest('tr') as HTMLElement;
    expect(within(pendingRow).getByText(/Rp 199\.000/)).toBeInTheDocument();
    expect(within(paidRow).getByText(/Rp 499\.000/)).toBeInTheDocument();
  });

  it('only offers payment/cancel actions for open invoices', async () => {
    renderSection();

    const pendingRow = (await screen.findByText('INV-0001')).closest('tr') as HTMLElement;
    const paidRow = screen.getByText('INV-0002').closest('tr') as HTMLElement;

    expect(within(pendingRow).getByText('Catat Pembayaran')).toBeInTheDocument();
    expect(within(pendingRow).getByText('Batalkan')).toBeInTheDocument();
    expect(within(paidRow).queryByText('Catat Pembayaran')).not.toBeInTheDocument();
    expect(within(paidRow).getByText('Selesai')).toBeInTheDocument();
  });

  it('records a manual payment with the typed method, reference and notes', async () => {
    renderSection();

    await userEvent.click(await action('INV-0001', 'Catat Pembayaran'));
    await userEvent.selectOptions(await screen.findByLabelText('Metode Pembayaran'), 'qris');
    await userEvent.type(screen.getByLabelText('No. Referensi / Bukti (Opsional)'), 'QR-123');
    await userEvent.type(screen.getByLabelText('Catatan (Opsional)'), 'transfer diterima');
    await userEvent.click(screen.getByText('Konfirmasi Bayar'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/platform/tenants/tenant-1/subscription/invoices/inv-1/pay', {
        amount: 199000,
        method: 'qris',
        referenceNumber: 'QR-123',
        notes: 'transfer diterima',
      }),
    );
  });

  it('cancels an invoice with the reason typed in the dialog', async () => {
    renderSection();

    await userEvent.click(await action('INV-0001', 'Batalkan'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/platform/tenants/tenant-1/subscription/invoices/inv-1/cancel', {
        reason: 'alasan test',
      }),
    );
  });

  it('shows payment attempts for the selected invoice', async () => {
    renderSection();

    await userEvent.click(await action('INV-0001', 'Pembayaran'));

    expect(await screen.findByText('Riwayat Pembayaran INV-0001')).toBeInTheDocument();
    expect(await screen.findByText('TRF-889')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/platform/tenants/tenant-1/subscription/invoices/inv-1/payments',
      ),
    );
  });
});
