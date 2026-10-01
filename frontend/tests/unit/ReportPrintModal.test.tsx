import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportPrintModal } from '../../src/core/pos/components/ReportPrintModal';

vi.mock('html2pdf.js', () => ({
  default: () => ({
    set: () => ({
      from: () => ({
        save: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
}));

describe('ReportPrintModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <ReportPrintModal open={false} variant="transactions" onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders transactions report with rounding line and item details', () => {
    const orders = [
      {
        id: 'ord-1',
        orderNumber: 'ORD-2026-001',
        status: 'paid',
        cashierName: 'Budi Kasir',
        total: 45500,
        roundingAdjustment: -500,
        items: [
          { productName: 'Nasi Goreng', quantity: 2, unitPrice: 20000, totalPrice: 40000 },
          { productName: 'Es Teh', quantity: 1, unitPrice: 6000, totalPrice: 6000 },
        ],
        paymentBreakdown: [{ method: 'cash', amount: 45500 }],
      },
    ];

    render(
      <ReportPrintModal
        open={true}
        variant="transactions"
        storeName="Kedai Kopi"
        orders={orders}
        totalOrders={1}
        totalRevenue={45500}
        totalRounding={-500}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Kedai Kopi')).toBeInTheDocument();
    expect(screen.getByText('Laporan Transaksi')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Nasi Goreng x2')).toBeInTheDocument();
    expect(screen.getByText('LUNAS')).toBeInTheDocument();
    expect(screen.getByText('Total Pembulatan')).toBeInTheDocument();
    expect(screen.getByText('Total Transaksi')).toBeInTheDocument();
  });

  it('renders cashier receipts breakdown with payment methods and carried-over bills', () => {
    const carriedBills = [
      {
        orderId: 'bill-1',
        orderNumber: 'BILL-001',
        total: 25000,
        cashierName: 'Budi Kasir',
        status: 'held',
        createdAt: '2026-09-30T10:00:00.000Z',
      },
    ];

    render(
      <ReportPrintModal
        open={true}
        variant="receipt"
        storeName="Kedai Kopi"
        paymentBreakdown={{ cash: 50000, qris: 30000 }}
        totalOrders={3}
        totalRevenue={80000}
        carriedOverBills={carriedBills}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Laporan Penerimaan Kasir')).toBeInTheDocument();
    expect(screen.getByText('Tunai')).toBeInTheDocument();
    expect(screen.getByText('QRIS')).toBeInTheDocument();
    expect(screen.getByText('BILL-001')).toBeInTheDocument();
    expect(screen.getByText('DIBERIKAN DARI SHIFT SEBELUMNYA')).toBeInTheDocument();
  });
});
