import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoidPayment } from '../../src/core/orders/components/VoidPayment';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import { TestQueryProvider } from '../helpers';
import type { Order } from '../../src/core/orders/hooks/useOrders';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from '../../src/@shared/services/api';

const mockOrder: Order = {
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
  paymentBreakdown: [
    { method: 'cash', code: 'CASH', amount: 30000, change: 0 },
    { method: 'qris', code: 'QRIS-001', amount: 25000, change: 0, cardLastFour: undefined },
  ],
  voidedItems: [],
  voidedAt: null,
  voidedBy: null,
  voidedByName: null,
  voidedReason: null,
  paidAt: '2026-07-21T10:00:00Z',
  createdAt: '2026-07-21T09:55:00Z',
  updatedAt: '2026-07-21T10:00:00Z',
};

function renderComponent(order = mockOrder, onClose = vi.fn()) {
  return render(
    <TestQueryProvider>
      <VoidPayment order={order} onClose={onClose} />
    </TestQueryProvider>,
  );
}

describe('VoidPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'user-1', email: 'kasir@test.com', displayName: 'Kasir A', role: 'cashier' } });
  });

  it('renders modal with payment breakdown', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: 'Void Pembayaran' })).toBeInTheDocument();
    expect(screen.getByText('Tunai')).toBeInTheDocument();
    expect(screen.getByText('QRIS')).toBeInTheDocument();
    expect(screen.getByText('CASH')).toBeInTheDocument();
    expect(screen.getByText('QRIS-001')).toBeInTheDocument();
  });

  it('shows message when no payments exist', () => {
    const noPaymentOrder = { ...mockOrder, paymentBreakdown: [] };
    renderComponent(noPaymentOrder);

    expect(screen.getByText(/Tidak ada pembayaran/)).toBeInTheDocument();
  });

  it('submit button is disabled until payment selected, reason filled, and confirmed', async () => {
    const user = userEvent.setup();
    renderComponent();

    const submitBtn = screen.getByRole('button', { name: /^Void Pembayaran$/i });
    expect(submitBtn).toBeDisabled();

    // Select a payment
    await user.click(screen.getByText('Tunai'));
    expect(submitBtn).toBeDisabled();

    // Fill reason
    await user.type(screen.getByPlaceholderText(/Masukkan alasan void pembayaran/), 'Double bayar');
    expect(submitBtn).toBeDisabled();

    // Check confirmation
    await user.click(screen.getByRole('checkbox'));
    expect(submitBtn).toBeEnabled();
  });

  it('highlights selected payment method', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('QRIS'));

    const selectedBtn = screen.getByText('QRIS').closest('button');
    expect(selectedBtn).toHaveClass('border-orange-500');
  });

  it('calls API with correct payment index', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { data: mockOrder } });

    renderComponent(mockOrder, onClose);

    // Select QRIS (index 1)
    await user.click(screen.getByText('QRIS'));
    await user.type(screen.getByPlaceholderText(/Masukkan alasan void pembayaran/), 'Gagal transaksi');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Void Pembayaran$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/orders/order-1/void-payment', {
        paymentIndex: 1,
        reason: 'Gagal transaksi',
        voidedByName: 'Kasir A',
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderComponent(mockOrder, onClose);

    await user.click(screen.getByRole('button', { name: /Batal/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('displays error state on API failure', async () => {
    const user = userEvent.setup();
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    renderComponent();

    await user.click(screen.getByText('Tunai'));
    await user.type(screen.getByPlaceholderText(/Masukkan alasan void pembayaran/), 'Test');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Void Pembayaran$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Gagal memvoid pembayaran/)).toBeInTheDocument();
    });
  });
});
