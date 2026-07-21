import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionHistory } from '../../src/core/orders/components/TransactionHistory';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '../../src/@shared/services/api';

const mockOrders = [
  {
    id: 'order-1',
    orderNumber: 'ORD-20260721-0001',
    status: 'paid',
    items: [
      { productId: 'p1', productName: 'Kopi Gula Aren', quantity: 2, unitPrice: 25000, subtotal: 50000, modifiers: [], tax: { rate: 0.1, amount: 5000 } },
    ],
    subtotal: 50000,
    discount: 0,
    tax: 5000,
    total: 55000,
    paymentStatus: 'paid',
    customerId: null,
    customerName: null,
    cashierId: 'user-1',
    cashierName: 'Kasir A',
    notes: '',
    source: 'pos',
    tableNumber: null,
    transactionType: 'dine_in',
    paymentBreakdown: [{ method: 'cash', code: 'CASH', amount: 60000, change: 5000 }],
    voidedItems: [],
    voidedAt: null,
    voidedBy: null,
    voidedByName: null,
    voidedReason: null,
    paidAt: '2026-07-21T10:00:00Z',
    createdAt: '2026-07-21T09:55:00Z',
    updatedAt: '2026-07-21T10:00:00Z',
  },
  {
    id: 'order-2',
    orderNumber: 'ORD-20260721-0002',
    status: 'draft',
    items: [
      { productId: 'p2', productName: 'Teh Manis', quantity: 1, unitPrice: 10000, subtotal: 10000, modifiers: [], tax: { rate: 0.1, amount: 1000 } },
    ],
    subtotal: 10000,
    discount: 0,
    tax: 1000,
    total: 11000,
    paymentStatus: 'unpaid',
    customerId: null,
    customerName: null,
    cashierId: 'user-1',
    cashierName: 'Kasir A',
    notes: '',
    source: 'pos',
    tableNumber: null,
    transactionType: 'dine_in',
    paymentBreakdown: [],
    voidedItems: [],
    voidedAt: null,
    voidedBy: null,
    voidedByName: null,
    voidedReason: null,
    paidAt: null,
    createdAt: '2026-07-21T10:10:00Z',
    updatedAt: '2026-07-21T10:10:00Z',
  },
];

function renderComponent() {
  return render(
    <TestQueryProvider>
      <TransactionHistory />
    </TestQueryProvider>,
  );
}

describe('TransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    (api.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}));
    renderComponent();

    expect(screen.getByText('Transaksi Terakhir')).toBeInTheDocument();
  });

  it('renders order list after loading', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: mockOrders, meta: { total: 2, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ORD-20260721-0001')).toBeInTheDocument();
    });
    expect(screen.getByText('ORD-20260721-0002')).toBeInTheDocument();
  });

  it('shows empty state when no orders', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: [], meta: { total: 0, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Belum ada transaksi/)).toBeInTheDocument();
    });
  });

  it('displays order total and status', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: mockOrders, meta: { total: 2, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Rp 55.000')).toBeInTheDocument();
    });
    expect(screen.getByText('Rp 11.000')).toBeInTheDocument();
  });

  it('expands order details on click', async () => {
    const user = userEvent.setup();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: mockOrders, meta: { total: 2, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ORD-20260721-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('ORD-20260721-0001'));

    expect(screen.getByText(/Kopi Gula Aren/)).toBeInTheDocument();
  });

  it('shows void buttons for voidable orders (paid status)', async () => {
    const user = userEvent.setup();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: mockOrders, meta: { total: 2, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ORD-20260721-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('ORD-20260721-0001'));

    expect(screen.getByText('Void Order')).toBeInTheDocument();
    expect(screen.getByText('Void Item')).toBeInTheDocument();
    expect(screen.getByText('Void Bayar')).toBeInTheDocument();
  });

  it('does not show void buttons for non-voidable orders (draft status)', async () => {
    const user = userEvent.setup();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: mockOrders, meta: { total: 2, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ORD-20260721-0002')).toBeInTheDocument();
    });

    await user.click(screen.getByText('ORD-20260721-0002'));

    expect(screen.queryByText('Void Order')).not.toBeInTheDocument();
    expect(screen.queryByText('Void Item')).not.toBeInTheDocument();
  });

  it('collapses expanded order on second click', async () => {
    const user = userEvent.setup();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: mockOrders, meta: { total: 2, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ORD-20260721-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('ORD-20260721-0001'));
    expect(screen.getByText(/Kopi Gula Aren/)).toBeInTheDocument();

    await user.click(screen.getByText('ORD-20260721-0001'));
    expect(screen.queryByText(/Kopi Gula Aren/)).not.toBeInTheDocument();
  });

  it('displays voided items info when present', async () => {
    const user = userEvent.setup();
    const orderWithVoid = {
      ...mockOrders[0],
      status: 'partially-voided',
      voidedItems: [
        { itemIndex: 0, productName: 'Kopi Gula Aren', quantity: 1, unitPrice: 25000, voidedAt: '2026-07-21T10:05:00Z', voidedReason: 'Salah', voidedByName: 'Kasir A' },
      ],
    };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: [orderWithVoid], meta: { total: 1, page: 1, limit: 15 } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ORD-20260721-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('ORD-20260721-0001'));

    expect(screen.getByText('Item Divoid:')).toBeInTheDocument();
    expect(screen.getByText(/Kopi Gula Aren.*x1.*Salah/)).toBeInTheDocument();
  });
});
