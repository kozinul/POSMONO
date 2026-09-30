import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportPage from '../../src/core/reports/pages/ReportPage';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../src/@shared/services/api';

const today = new Date().toISOString().split('T')[0];

const dailyReport = {
  totalOrders: 12,
  totalRevenue: 1_500_000,
  totalItems: 30,
  totalDiscount: 50_000,
  totalTax: 120_000,
  totalServiceCharge: 0,
  totalRounding: 500,
  paymentBreakdown: [{ method: 'cash', total: 1_500_000, count: 12 }],
  orders: [],
  topProducts: [],
  hourlyBreakdown: [],
  shifts: [],
};

const financeReport = {
  netRevenue: 2_640_000,
  totalOrders: 9,
  totalRevenue: 3_000_000,
  totalDiscount: 100_000,
  totalTax: 240_000,
  totalServiceCharge: 20_000,
  totalRounding: 0,
  dpp: 2_640_000,
  paymentBreakdown: [],
  categories: [
    {
      categoryId: 'cat-1',
      totalItems: 5,
      dpp: 880_000,
      revenue: 1_000_000,
      serviceCharge: 0,
      tax: 80_000,
    },
  ],
};

const salesReport = {
  netRevenue: 352_000,
  totalOrders: 4,
  totalRevenue: 400_000,
  totalItems: 8,
  totalDiscount: 0,
  totalTax: 32_000,
  totalServiceCharge: 0,
  totalRounding: 0,
  orders: [{ id: 'o1', orderNumber: 'ORD-1', total: 400_000, paymentMethod: 'cash' }],
  products: [],
};

function emptyReport() {
  return {
    totalOrders: 0,
    totalRevenue: 0,
    totalItems: 0,
    totalDiscount: 0,
    totalTax: 0,
    totalServiceCharge: 0,
    totalRounding: 0,
    dpp: 0,
    paymentBreakdown: [],
    categories: [],
    orders: [],
    products: [],
    cashiers: [],
    totals: {},
    netRevenue: 0,
    netProfit: 0,
    grossProfit: 0,
    cogsUnits: 0,
    totalCogs: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    items: [],
    lowStockCount: 0,
    refunds: [],
  };
}

function mockApi() {
  const respond = (url: string, data: unknown) => Promise.resolve({ data: { success: true, data } });
  vi.mocked(api.get).mockImplementation((url: string) => {
    const u = String(url);
    if (u.startsWith('/reports/daily')) return respond(u, dailyReport);
    if (u.startsWith('/reports/finance')) return respond(u, financeReport);
    if (u.startsWith('/reports/sales?')) return respond(u, salesReport);
    if (u.startsWith('/reports/dashboard')) return respond(u, {});
    if (u.startsWith('/categories')) return respond(u, [{ id: 'cat-1', name: 'Kopi' }]);
    return respond(u, emptyReport());
  });
}

function renderPage() {
  return render(
    <TestQueryProvider>
      <ReportPage />
    </TestQueryProvider>,
  );
}

function sidebarButton(label: string) {
  return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

describe('ReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('merender chrome halaman, daftar 10 laporan, dan tab harian sebagai default', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Laporan' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('button')).toHaveLength(10);
    expect(within(nav).getByRole('button', { name: /Laporan Harian/ })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Laporan Harian' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  });

  it('berganti tab dan memuat data laporan tab tersebut', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Laporan Harian' });

    await userEvent.click(sidebarButton('Laporan Keuangan'));
    expect(await screen.findByRole('heading', { name: 'Laporan Keuangan' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Kopi')).toBeInTheDocument());

    await userEvent.click(sidebarButton('Laporan Penjualan'));
    expect(await screen.findByRole('heading', { name: 'Laporan Penjualan' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ORD-1')).toBeInTheDocument());
  });

  it('hanya tab aktif yang memanggil endpoint-nya', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Laporan Harian' });
    const called = () => vi.mocked(api.get).mock.calls.map((c) => String(c[0]));
    expect(called().some((u) => u.startsWith('/reports/finance'))).toBe(false);
    expect(called().some((u) => u.startsWith('/reports/daily'))).toBe(true);

    await userEvent.click(sidebarButton('Laporan Keuangan'));
    await screen.findByRole('heading', { name: 'Laporan Keuangan' });
    await waitFor(() => expect(called().some((u) => u.startsWith('/reports/finance'))).toBe(true));
  });

  it('memfilter sidebar lewat pencarian dan memindahkan tab aktif ke hasil pertama', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Laporan Harian' });

    await userEvent.type(screen.getByPlaceholderText('Cari laporan...'), 'laba');
    await waitFor(() => {
      const nav = screen.getByRole('navigation');
      expect(within(nav).getAllByRole('button')).toHaveLength(1);
    });
    expect(await screen.findByRole('heading', { name: /Laba Rugi/ })).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText('Cari laporan...'));
    await userEvent.type(screen.getByPlaceholderText('Cari laporan...'), 'zzz');
    expect(await screen.findByText('Tidak ada laporan')).toBeInTheDocument();
  });

  it('filter tanggal tiap tab independen (tidak di-share antar tab)', async () => {
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Laporan Harian' });

    const firstDateInput = () => container.querySelector('input[type="date"]') as HTMLInputElement;

    await userEvent.click(screen.getByRole('button', { name: /Laporan Penjualan/ }));
    await screen.findByRole('heading', { name: 'Laporan Penjualan' });
    fireEvent.change(firstDateInput(), { target: { value: '2026-01-05' } });
    expect(firstDateInput()).toHaveValue('2026-01-05');

    await userEvent.click(screen.getByRole('button', { name: /Laporan Keuangan/ }));
    await screen.findByRole('heading', { name: 'Laporan Keuangan' });
    expect(firstDateInput()).toHaveValue(today);

    await userEvent.click(screen.getByRole('button', { name: /Laporan Penjualan/ }));
    await screen.findByRole('heading', { name: 'Laporan Penjualan' });
    expect(firstDateInput()).toHaveValue('2026-01-05');
  });

  it('menampilkan empty state saat endpoint tidak mengembalikan data', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Laporan Harian' });
    await userEvent.click(sidebarButton('Ringkasan Stok'));
    expect(await screen.findByRole('heading', { name: 'Ringkasan Stok' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Belum ada data stok')).toBeInTheDocument());
  });
});
