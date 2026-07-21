import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoidItemModal } from '../../src/core/orders/components/VoidItemModal';
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
    { productId: 'p3', productName: 'Mie Goreng', quantity: 1, unitPrice: 15000, subtotal: 15000, modifiers: [], tax: { rate: 0.1, amount: 1500 }, isVoided: true, voidedAt: '2026-07-21T10:05:00Z', voidedReason: 'Salah input' },
  ],
  subtotal: 75000,
  discount: 0,
  tax: 7500,
  total: 82500,
  paymentStatus: 'paid',
  customerId: null,
  customerName: null,
  cashierId: 'user-1',
  cashierName: 'Kasir A',
  notes: '',
  source: 'pos',
  tableNumber: null,
  transactionType: 'dine_in',
  paymentBreakdown: [],
  voidedItems: [{ itemIndex: 2, productName: 'Mie Goreng', quantity: 1, unitPrice: 15000, voidedAt: '2026-07-21T10:05:00Z', voidedReason: 'Salah input', voidedByName: 'Kasir A' }],
  voidedAt: null,
  voidedBy: null,
  voidedByName: null,
  voidedReason: null,
  paidAt: '2026-07-21T10:00:00Z',
  createdAt: '2026-07-21T09:55:00Z',
  updatedAt: '2026-07-21T10:05:00Z',
};

function renderModal(order = mockOrder, onClose = vi.fn()) {
  return render(
    <TestQueryProvider>
      <VoidItemModal order={order} onClose={onClose} />
    </TestQueryProvider>,
  );
}

describe('VoidItemModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'user-1', email: 'kasir@test.com', displayName: 'Kasir A', role: 'cashier' } });
  });

  it('renders modal with item selection', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Void Item' })).toBeInTheDocument();
    expect(screen.getByText('Kopi Gula Aren')).toBeInTheDocument();
    expect(screen.getByText('Teh Manis')).toBeInTheDocument();
  });

  it('hides voided items from selection', () => {
    renderModal();

    expect(screen.queryByText('Mie Goreng')).not.toBeInTheDocument();
  });

  it('shows message when all items are voided', () => {
    const allVoidedOrder = {
      ...mockOrder,
      items: mockOrder.items.map((i) => ({ ...i, isVoided: true })),
    };
    renderModal(allVoidedOrder);

    expect(screen.getByText(/Semua item sudah divoid/)).toBeInTheDocument();
  });

  it('submit button is disabled until item selected, reason filled, and confirmed', async () => {
    const user = userEvent.setup();
    renderModal();

    const submitBtn = screen.getByRole('button', { name: /^Void Item$/i });
    expect(submitBtn).toBeDisabled();

    // Select an item
    await user.click(screen.getByText('Kopi Gula Aren'));
    expect(submitBtn).toBeDisabled();

    // Fill reason
    await user.type(screen.getByPlaceholderText(/Masukkan alasan void item/), 'Salah');
    expect(submitBtn).toBeDisabled();

    // Check confirmation
    await user.click(screen.getByRole('checkbox'));
    expect(submitBtn).toBeEnabled();
  });

  it('highlights selected item visually', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText('Kopi Gula Aren'));

    const selectedButton = screen.getByText('Kopi Gula Aren').closest('button');
    expect(selectedButton).toHaveClass('border-red-500');
  });

  it('calls API with correct item index on submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { data: mockOrder } });

    renderModal(mockOrder, onClose);

    // Select first active item (Kopi Gula Aren at index 0)
    await user.click(screen.getByText('Kopi Gula Aren'));
    await user.type(screen.getByPlaceholderText(/Masukkan alasan void item/), 'Salah pesan');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Void Item$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/orders/order-1/void-item', {
        itemIndex: 0,
        reason: 'Salah pesan',
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
});
