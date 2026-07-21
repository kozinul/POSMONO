import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoidOrderModal } from '../../src/core/orders/components/VoidOrderModal';
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
    { productId: 'p2', productName: 'Teh Manis', quantity: 1, unitPrice: 10000, subtotal: 10000, modifiers: [], tax: { rate: 0.1, amount: 1000 } },
  ],
  subtotal: 60000,
  discount: 0,
  tax: 6000,
  total: 66000,
  paymentStatus: 'paid',
  customerId: null,
  customerName: null,
  cashierId: 'user-1',
  cashierName: 'Kasir A',
  notes: '',
  source: 'pos',
  tableNumber: null,
  transactionType: 'dine_in',
  paymentBreakdown: [{ method: 'cash', code: 'CASH', amount: 70000, change: 4000 }],
  voidedItems: [],
  voidedAt: null,
  voidedBy: null,
  voidedByName: null,
  voidedReason: null,
  paidAt: '2026-07-21T10:00:00Z',
  createdAt: '2026-07-21T09:55:00Z',
  updatedAt: '2026-07-21T10:00:00Z',
};

function renderModal(order = mockOrder, onClose = vi.fn()) {
  return render(
    <TestQueryProvider>
      <VoidOrderModal order={order} onClose={onClose} />
    </TestQueryProvider>,
  );
}

describe('VoidOrderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'user-1', email: 'kasir@test.com', displayName: 'Kasir A', role: 'cashier' } });
  });

  it('renders modal with order details', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Void Order' })).toBeInTheDocument();
    expect(screen.getAllByText('ORD-20260721-0001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Rp 66\.000/)).toBeInTheDocument();
    expect(screen.getByText(/2 item/)).toBeInTheDocument();
  });

  it('shows warning message', () => {
    renderModal();

    expect(screen.getByText(/Peringatan/)).toBeInTheDocument();
    expect(screen.getByText(/memvoid seluruh order/)).toBeInTheDocument();
  });

  it('has disabled submit button initially', () => {
    renderModal();

    const submitBtn = screen.getByRole('button', { name: /^Void Order$/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit after filling reason and checking confirmation', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(/Masukkan alasan void/), 'Salah order');
    await user.click(screen.getByRole('checkbox'));

    const submitBtn = screen.getByRole('button', { name: /^Void Order$/i });
    expect(submitBtn).toBeEnabled();
  });

  it('calls API and onClose on successful submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { data: mockOrder } });

    renderModal(mockOrder, onClose);

    await user.type(screen.getByPlaceholderText(/Masukkan alasan void/), 'Salah order');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Void Order$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/orders/order-1/void', {
        reason: 'Salah order',
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
    renderModal(mockOrder, onClose);

    await user.click(screen.getByRole('button', { name: /Batal/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('displays error state when API fails', async () => {
    const user = userEvent.setup();
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    renderModal();

    await user.type(screen.getByPlaceholderText(/Masukkan alasan void/), 'Test');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Void Order$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Gagal memvoid order/)).toBeInTheDocument();
    });
  });
});
