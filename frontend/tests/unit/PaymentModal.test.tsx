import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentModal } from '../../src/core/pos/components/PaymentModal';
import { usePOSStore } from '../../src/core/pos/store/posStore';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
  },
}));

vi.mock('../../src/@shared/hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('../../src/core/printing/utils/autoPrint', () => ({
  tryClientAutoPrint: vi.fn().mockResolvedValue(true),
}));

import { api } from '../../src/@shared/services/api';
import { tryClientAutoPrint } from '../../src/core/printing/utils/autoPrint';

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePOSStore.setState({
      items: [
        {
          productId: 'prod-1',
          name: 'Kopi Susu',
          price: 25000,
          quantity: 2,
          categoryId: 'cat-1',
          imageUrl: '',
        },
      ],
      pricing: {
        originalSubtotal: 50000,
        promotionDiscount: 0,
        netSubtotal: 50000,
        taxTotal: 0,
        serviceChargeTotal: 0,
        rounding: 0,
        grandTotal: 50000,
        roundedPayable: 50000,
        taxDetails: [],
        appliedPromotions: [],
        lineItems: [],
        freeItemValue: 0,
      },
      paymentModalOpen: true,
      openShiftId: 'shift-1',
    } as any);

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/payment-methods')) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 'pm-1', name: 'Tunai', code: 'cash', isActive: true, sortOrder: 1 },
              { id: 'pm-2', name: 'QRIS', code: 'qris', isActive: true, sortOrder: 2 },
              { id: 'pm-3', name: 'Transfer', code: 'transfer', isActive: true, sortOrder: 3 },
            ],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it('renders payment method options and total payable', async () => {
    render(
      <TestQueryProvider>
        <PaymentModal />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Pembayaran')).toBeInTheDocument();
    expect(screen.getByText('Tunai')).toBeInTheDocument();
    expect(screen.getByText('QRIS')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 50.000')).toHaveLength(2);
  });

  it('handles cash payment flow and invokes auto-print on success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          payment: { id: 'pay-1', method: 'cash', amount: 50000, status: 'completed' },
          order: { id: 'ord-1', orderNumber: 'ORD-001', total: 50000 },
          receipt: { layout: {}, viewModel: {} },
        },
      },
    });

    render(
      <TestQueryProvider>
        <PaymentModal />
      </TestQueryProvider>,
    );

    await userEvent.click(await screen.findByText('Tunai'));
    await userEvent.click(screen.getByText('Uang Pas'));

    const payBtn = screen.getByRole('button', { name: /^Bayar/ });
    await userEvent.click(payBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/payments/pay-cash',
        expect.objectContaining({
          amountPaid: 50000,
          method: 'cash',
        }),
      );
    });

    await waitFor(() => {
      expect(tryClientAutoPrint).toHaveBeenCalled();
    });
  });
});
