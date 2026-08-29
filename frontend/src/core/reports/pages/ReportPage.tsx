import { useState, useEffect, useMemo, Fragment } from 'react';
import { useDailyReport, useSalesReport, useFinanceReport } from '../../orders/hooks/useOrders';
import { useSalesPerProductReport } from '../hooks/useSalesPerProductReport';
import { useCashierReceiptsReport } from '../hooks/useCashierReceiptsReport';
import { useSalesPerCashierReport } from '../hooks/useSalesPerCashierReport';
import { useProfitLossReport } from '../hooks/useProfitLossReport';
import { useInventorySummaryReport } from '../hooks/useInventorySummaryReport';
import { useRefundReport, refundReference, type RefundRow } from '../../payments/hooks/useRefund';
import { RefundReceiptModal } from '../components/RefundReceiptModal';
import { useReportExport, ReportType } from '../hooks/useReportExport';
import { useCategories } from '../../pos/hooks/useProducts';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import { formatCurrency } from '../../../@shared/utils/format';

const reports = [
  {
    id: 'daily',
    label: 'Laporan Harian',
    keywords: 'harian daily tanggal penjualan shift pembayaran ringkasan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008z" />
      </svg>
    ),
  },
  {
    id: 'sales',
    label: 'Laporan Penjualan',
    keywords: 'penjualan sales order periode transaksi',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    id: 'finance',
    label: 'Laporan Keuangan',
    keywords: 'keuangan finance pajak ppn service charge diskon dpp nett',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'profit-loss',
    label: 'Laba Rugi',
    keywords: 'laba rugi profit loss profit hpp cogs margin untung modal',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: 'sales-per-product',
    label: 'Penjualan per Produk',
    keywords: 'produk product qty per item terlaris',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7.5A1.5 1.5 0 006 6.5v11A1.5 1.5 0 007.5 19h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0016.5 5H15m-6 0a1.5 1.5 0 001.5 1.5H12A1.5 1.5 0 0013.5 5m-6 0A1.5 1.5 0 016 3.5h3M10.5 9h6m-6 3h6m-6 3h3" />
      </svg>
    ),
  },
  {
    id: 'cashier-receipts',
    label: 'Penerimaan per Kasir',
    keywords: 'penerimaan kasir cashier pembayaran metode tunai qris transfer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5a1.5 1.5 0 011.5-1.5h15a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18v-7.5zM6.75 9.75V6a2.25 2.25 0 012.25-2.25h6A2.25 2.25 0 0117.25 6v3.75M8.25 14.25h.008v.008H8.25v-.008zm3 0h.008v.008H11.25v-.008zm3 0h.008v.008H14.25v-.008zm-6 3h.008v.008H8.25v-.008zm3 0h.008v.008H11.25v-.008zm3 0h.008v.008H14.25v-.008z" />
      </svg>
    ),
  },
  {
    id: 'sales-per-cashier',
    label: 'Penjualan per Kasir',
    keywords: 'penjualan kasir cashier order transaksi item rata-rata',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'inventory-summary',
    label: 'Ringkasan Stok',
    keywords: 'stok inventory persediaan stock gudang menipis reserved nilai opname',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    id: 'refunds',
    label: 'Laporan Refund',
    keywords: 'refund pengembalian return uang kembali kompensasi pembatalan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.75h3.75a2.25 2.25 0 100-4.5H7.5m3.75 4.5v-1.5m0 1.5h1.5m-1.5-3H9.75m-3 0H6M12 3v18m-7.5-6h15a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0019.5 3h-15A1.5 1.5 0 003 4.5v9a1.5 1.5 0 001.5 1.5z" />
      </svg>
    ),
  },
];

const inputCls =
  'block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelCls = 'block text-xs text-gray-500 mb-1';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
    </div>
  );
}

function ExportButtons({
  type,
  params,
  disabled,
}: {
  type: ReportType;
  params: Record<string, string>;
  disabled?: boolean;
}) {
  const exportReport = useReportExport();
  const busy = exportReport.isPending;
  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => exportReport.mutate({ type, params, format: 'pdf' })}
        disabled={disabled || busy}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        {busy ? 'Menyiapkan...' : 'Download PDF'}
      </button>
      <button
        onClick={() => exportReport.mutate({ type, params, format: 'xlsx' })}
        disabled={disabled || busy}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6M8 3h8l4 4v14H8a2 2 0 01-2-2V5a2 2 0 012-2zm8 0v4h4" />
        </svg>
        {busy ? 'Menyiapkan...' : 'Download Excel'}
      </button>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReportPage() {
  const today = new Date().toISOString().split('T')[0];
  const [search, setSearch] = useState('');
  const [activeReport, setActiveReport] = useState('daily');

  const [selectedDate, setSelectedDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [financeFrom, setFinanceFrom] = useState(today);
  const [financeTo, setFinanceTo] = useState(today);
  const [plFrom, setPlFrom] = useState(today);
  const [plTo, setPlTo] = useState(today);
  const [sppFrom, setSppFrom] = useState(today);
  const [sppTo, setSppTo] = useState(today);
  const [cashierReceiptsFrom, setCashierReceiptsFrom] = useState(today);
  const [cashierReceiptsTo, setCashierReceiptsTo] = useState(today);
  const [spcFrom, setSpcFrom] = useState(today);
  const [spcTo, setSpcTo] = useState(today);
  const [invFrom, setInvFrom] = useState(today);
  const [invTo, setInvTo] = useState(today);
  const [refundFrom, setRefundFrom] = useState(today);
  const [refundTo, setRefundTo] = useState(today);
  const [selectedRefund, setSelectedRefund] = useState<RefundRow | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const { data: daily, isLoading: dailyLoading } = useDailyReport(selectedDate);
  const { data: sales, isLoading: salesLoading } = useSalesReport(
    dateFrom || today,
    dateTo || today,
  );
  const { data: finance, isLoading: financeLoading } = useFinanceReport(
    financeFrom || today,
    financeTo || today,
  );
  const { data: pl, isLoading: plLoading } = useProfitLossReport(plFrom || today, plTo || today);
  const { data: spp, isLoading: sppLoading } = useSalesPerProductReport(
    sppFrom || today,
    sppTo || today,
  );
  const { data: cashierReceipts, isLoading: cashierReceiptsLoading } = useCashierReceiptsReport(
    cashierReceiptsFrom || today,
    cashierReceiptsTo || today,
  );
  const { data: spc, isLoading: spcLoading } = useSalesPerCashierReport(
    spcFrom || today,
    spcTo || today,
  );
  const { data: inventory, isLoading: inventoryLoading } = useInventorySummaryReport(
    invFrom || today,
    invTo || today,
  );
  const { data: refunds, isLoading: refundsLoading } = useRefundReport(
    refundFrom || today,
    refundTo || today,
  );
  const { data: categories = [] } = useCategories();

  const getCategoryName = (categoryId: string | null) =>
    categoryId ? categories.find((c) => c.id === categoryId)?.name || 'Lainnya' : 'Tanpa kategori';

  const filteredReports = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.keywords.toLowerCase().includes(q),
    );
  }, [search]);

  useEffect(() => {
    if (filteredReports.length > 0 && !filteredReports.find((r) => r.id === activeReport)) {
      setActiveReport(filteredReports[0].id);
    }
  }, [filteredReports, activeReport]);

  const inventoryGroups = useMemo(() => {
    if (!inventory) return [];
    const map = new Map<string, typeof inventory.items>();
    for (const it of inventory.items) {
      const arr = map.get(it.productId) ?? [];
      arr.push(it);
      map.set(it.productId, arr);
    }
    return Array.from(map.values()).map((rows) => {
      const first = rows[0];
      return {
        productId: first.productId,
        productName: first.productName || '(tanpa nama)',
        sku: first.sku,
        categoryName: first.categoryName,
        rows,
        quantity: rows.reduce((s, r) => s + r.quantity, 0),
        reserved: rows.reduce((s, r) => s + r.reservedQuantity, 0),
        available: rows.reduce((s, r) => s + r.availableQuantity, 0),
        value: rows.reduce((s, r) => s + r.value, 0),
        openingQuantity: rows.reduce((s, r) => s + r.openingQuantity, 0),
        openingValue: rows.reduce((s, r) => s + r.openingValue, 0),
        movements: rows.reduce(
          (s, r) => ({
            in: s.in + r.movements.in,
            out: s.out + r.movements.out,
            void: s.void + r.movements.void,
          }),
          { in: 0, out: 0, void: 0 },
        ),
      };
    });
  }, [inventory]);

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Top Bar */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 shrink-0">Laporan</h1>
          <div className="flex-1 relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              placeholder="Cari laporan..."
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto py-4">
          {filteredReports.length === 0 ? (
            <p className="px-4 text-sm text-gray-400">Tidak ada laporan</p>
          ) : (
            <ul className="space-y-0.5 px-2">
              {filteredReports.map((report) => (
                <li key={report.id}>
                  <button
                    onClick={() => setActiveReport(report.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      activeReport === report.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className={activeReport === report.id ? 'text-blue-600' : 'text-gray-400'}>
                      {report.icon}
                    </span>
                    {report.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto p-6 space-y-8 pb-12">
            {activeReport === 'daily' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Laporan Harian</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Ringkasan transaksi per tanggal</p>
                  </div>
                  <ExportButtons type="daily" params={{ date: selectedDate }} disabled={!daily} />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="max-w-xs">
                    <label className={labelCls}>Tanggal</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {dailyLoading ? (
                    <Spinner />
                  ) : daily ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Orders</p>
                          <p className="text-xl font-bold text-gray-900">{daily.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Revenue</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(daily.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Items Sold</p>
                          <p className="text-xl font-bold text-gray-900">{daily.totalItems}</p>
                        </div>
                      </div>
                      {daily.totalRounding != null && daily.totalRounding !== 0 && (
                        <div className="flex justify-between text-sm bg-purple-50 rounded-lg p-3">
                          <span className="text-purple-700">Total Pembulatan (termasuk revenue)</span>
                          <span className="text-purple-800 font-bold">
                            {daily.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(daily.totalRounding))}
                          </span>
                        </div>
                      )}
                      {daily.shifts.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Shifts</h3>
                          <div className="space-y-2">
                            {daily.shifts.map((shift: any) => (
                              <div key={shift.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                                <div>
                                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${shift.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  <span className="text-gray-700">
                                    Opened: {new Date(shift.openedAt).toLocaleTimeString('id-ID')}
                                  </span>
                                </div>
                                <span className="text-gray-500">
                                  Balance: {formatCurrency(shift.openingBalance)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No data for this date</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'sales' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Laporan Penjualan</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Ringkasan penjualan pada periode tertentu</p>
                  </div>
                  <ExportButtons
                    type="sales"
                    params={{ dateFrom: dateFrom || today, dateTo: dateTo || today }}
                    disabled={!sales}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {salesLoading ? (
                    <Spinner />
                  ) : sales ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Orders</p>
                          <p className="text-xl font-bold text-gray-900">{sales.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Revenue</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(sales.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Items Sold</p>
                          <p className="text-xl font-bold text-gray-900">{sales.totalItems}</p>
                        </div>
                      </div>
                      {sales.totalRounding != null && sales.totalRounding !== 0 && (
                        <div className="flex justify-between text-sm bg-purple-50 rounded-lg p-3">
                          <span className="text-purple-700">Total Pembulatan (termasuk revenue)</span>
                          <span className="text-purple-800 font-bold">
                            {sales.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(sales.totalRounding))}
                          </span>
                        </div>
                      )}
                      {sales.salesByCategory && sales.salesByCategory.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Penjualan per Kategori</h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {sales.salesByCategory.map((cat, idx) => (
                                  <tr key={cat.categoryId ?? `uncat-${idx}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-900">{getCategoryName(cat.categoryId)}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{cat.totalItems}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(cat.totalRevenue)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Orders in Period</h3>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {sales.orders.map((order: any) => (
                            <div key={order.id} className="flex items-center justify-between text-sm py-1">
                              <span className="text-gray-700">{order.orderNumber}</span>
                              <span className="flex items-center gap-2">
                                {order.roundingAdjustment != null && order.roundingAdjustment !== 0 && (
                                  <span className="text-xs text-purple-600">
                                    {order.roundingAdjustment > 0 ? '+' : '-'}{formatCurrency(Math.abs(order.roundingAdjustment))}
                                  </span>
                                )}
                                <span className="font-medium text-gray-900">
                                  {formatCurrency(order.total + (order.roundingAdjustment ?? 0))}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a date range</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'finance' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Laporan Keuangan</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Ringkasan keuangan, pajak, dan diskon</p>
                  </div>
                  <ExportButtons
                    type="finance"
                    params={{ dateFrom: financeFrom || today, dateTo: financeTo || today }}
                    disabled={!finance}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={financeFrom} onChange={(e) => setFinanceFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={financeTo} onChange={(e) => setFinanceTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {financeLoading ? (
                    <Spinner />
                  ) : finance ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Revenue</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Nett (DPP)</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.netRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pajak (PPN)</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalTax)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Service Charge</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalServiceCharge)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Diskon</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalDiscount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Orders</p>
                          <p className="text-xl font-bold text-gray-900">{finance.totalOrders}</p>
                        </div>
                        {finance.totalRounding != null && finance.totalRounding !== 0 && (
                          <div>
                            <p className="text-xs text-gray-500">Pembulatan (termasuk revenue)</p>
                            <p className="text-xl font-bold text-gray-900">
                              {finance.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(finance.totalRounding))}
                            </p>
                          </div>
                        )}
                      </div>

                      {finance.categories.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">DPP</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pajak</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SC</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {finance.categories.map((cat, idx) => (
                                <tr key={cat.categoryId ?? `uncat-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{getCategoryName(cat.categoryId)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{cat.totalItems}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(cat.revenue)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatCurrency(cat.dpp)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatCurrency(cat.tax)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatCurrency(cat.serviceCharge)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a date range</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'profit-loss' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Laporan Laba Rugi</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Pendapatan dikurangi HPP & biaya periode</p>
                  </div>
                  <ExportButtons
                    type="profit-loss"
                    params={{ dateFrom: plFrom || today, dateTo: plTo || today }}
                    disabled={!pl}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={plFrom} onChange={(e) => setPlFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={plTo} onChange={(e) => setPlTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {plLoading ? (
                    <Spinner />
                  ) : pl ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Order</p>
                          <p className="text-xl font-bold text-gray-900">{pl.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Pendapatan</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(pl.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">HPP (COGS)</p>
                          <p className="text-xl font-bold text-red-600">{formatCurrency(pl.totalCogs)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Laba Kotor</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(pl.grossProfit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Margin Kotor</p>
                          <p className="text-xl font-bold text-gray-900">{pl.grossMarginPct}%</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metrik</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">Total Order</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right font-semibold">{pl.totalOrders}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">Total Pendapatan</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(pl.totalRevenue)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">HPP (Harga Pokok Penjualan) · {pl.cogsUnits} unit</td>
                              <td className="px-4 py-2 text-sm text-red-600 text-right">{formatCurrency(pl.totalCogs)}</td>
                            </tr>
                            <tr className="bg-emerald-50/50 hover:bg-emerald-50">
                              <td className="px-4 py-2 text-sm font-semibold text-gray-900">Laba Kotor</td>
                              <td className="px-4 py-2 text-sm font-semibold text-emerald-700 text-right">{formatCurrency(pl.grossProfit)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">Margin Kotor</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{pl.grossMarginPct}%</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">Diskon</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">-{formatCurrency(pl.totalDiscount)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">Pajak (PPN)</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">-{formatCurrency(pl.totalTax)}</td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">Service Charge</td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">-{formatCurrency(pl.totalServiceCharge)}</td>
                            </tr>
                            {pl.totalRounding != null && pl.totalRounding !== 0 && (
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-900">Pembulatan</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                  {pl.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(pl.totalRounding))}
                                </td>
                              </tr>
                            )}
                            <tr className="bg-emerald-50 hover:bg-emerald-50">
                              <td className="px-4 py-2 text-sm font-bold text-gray-900">Laba Bersih</td>
                              <td className="px-4 py-2 text-sm font-bold text-emerald-700 text-right">{formatCurrency(pl.netProfit)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a date range</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'sales-per-product' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Penjualan per Produk</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Rincian penjualan tiap produk</p>
                  </div>
                  <ExportButtons
                    type="sales-per-product"
                    params={{ dateFrom: sppFrom || today, dateTo: sppTo || today }}
                    disabled={!spp || spp.rows.length === 0}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={sppFrom} onChange={(e) => setSppFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={sppTo} onChange={(e) => setSppTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {sppLoading ? (
                    <Spinner />
                  ) : spp && spp.rows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="w-8 px-4 py-3" />
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Produk</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Qty</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Total Penjualan</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">DPP</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">SC</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Pajak</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Grand Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {spp.rows.map((row) => {
                            const isExpanded = expandedProduct === row.productId;
                            const grandTotal = row.totalSales + row.tax + row.serviceCharge;

                            return (
                              <Fragment key={row.productId}>
                                <tr
                                  className="hover:bg-gray-50 cursor-pointer select-none"
                                  onClick={() => setExpandedProduct(isExpanded ? null : row.productId)}
                                >
                                  <td className="px-4 py-3 text-gray-400">
                                    <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                      &#9654;
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-900 font-medium">{row.productName}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{row.quantity}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.totalSales)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.dpp)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.serviceCharge)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.tax)}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                                    {formatCurrency(grandTotal)}
                                  </td>
                                </tr>
                                {isExpanded && row.transactions.map((tx, idx) => {
                                  const txGrandTotal = tx.unitPrice * tx.quantity + tx.serviceCharge + tx.tax;
                                  return (
                                    <tr key={`${row.productId}-${idx}`} className="bg-gray-50">
                                      <td />
                                      <td className="px-4 py-2 pl-10 text-gray-500 text-xs">
                                        {tx.orderId}
                                      </td>
                                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{tx.quantity}</td>
                                      <td className="px-4 py-2 text-right text-gray-500 text-xs">
                                        {formatCurrency(tx.unitPrice * tx.quantity)}
                                      </td>
                                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatCurrency(tx.dpp)}</td>
                                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatCurrency(tx.serviceCharge)}</td>
                                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatCurrency(tx.tax)}</td>
                                      <td className="px-4 py-2 text-right text-gray-500 text-xs font-medium">
                                        {formatCurrency(txGrandTotal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {isExpanded && (
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <td colSpan={8} className="px-4 py-1 text-right text-xs text-gray-400">
                                      {row.transactions.length} transaksi &middot; {formatDate(row.transactions[0]?.createdAt)}{row.transactions.length > 1 ? ` - ${formatDate(row.transactions[row.transactions.length - 1]?.createdAt)}` : ''}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                          {spp.summary.totalRounding !== 0 && (
                            <tr>
                              <td />
                              <td className="px-4 py-2 text-gray-500 font-medium">Pembulatan</td>
                              <td colSpan={5} />
                              <td className="px-4 py-2 text-right text-purple-700">
                                {spp.summary.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(spp.summary.totalRounding))}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td />
                            <td className="px-4 py-3 text-gray-900">Total</td>
                            <td className="px-4 py-3 text-right text-gray-900">{spp.summary.quantity}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.totalSales)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.dpp)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.serviceCharge)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.tax)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.grandTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a date range</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'cashier-receipts' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Penerimaan per Kasir</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Rincian penerimaan tiap kasir menurut metode pembayaran</p>
                  </div>
                  <ExportButtons
                    type="cashier-receipts"
                    params={{ dateFrom: cashierReceiptsFrom || today, dateTo: cashierReceiptsTo || today }}
                    disabled={!cashierReceipts || cashierReceipts.cashiers.length === 0}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={cashierReceiptsFrom} onChange={(e) => setCashierReceiptsFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={cashierReceiptsTo} onChange={(e) => setCashierReceiptsTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {cashierReceiptsLoading ? (
                    <Spinner />
                  ) : cashierReceipts && cashierReceipts.cashiers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Kasir</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Metode</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Transaksi</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Penerimaan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cashierReceipts.cashiers.map((c) => (
                            <Fragment key={c.cashierId}>
                              <tr className="bg-blue-50/50">
                                <td className="px-4 py-3 text-gray-900 font-semibold">{c.cashierName}</td>
                                <td className="px-4 py-3 text-gray-400" />
                                <td className="px-4 py-3 text-right text-gray-700 font-medium">{c.totalTransactions}</td>
                                <td className="px-4 py-3 text-right text-gray-900 font-bold">
                                  {formatCurrency(c.total)}
                                </td>
                              </tr>
                              {c.methods.map((m) => (
                                <tr key={`${c.cashierId}-${m.method}`}>
                                  <td />
                                  <td className="px-4 py-2 pl-10 text-gray-600">{paymentMethodLabel(m.method)}</td>
                                  <td className="px-4 py-2 text-right text-gray-500">{m.count}</td>
                                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(m.total)}</td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                          <tr>
                            <td className="px-4 py-3 text-gray-900">Total</td>
                            <td />
                            <td className="px-4 py-3 text-right text-gray-900">{cashierReceipts.totals.totalTransactions}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(cashierReceipts.totals.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Tidak ada penerimaan pada periode ini</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'sales-per-cashier' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Penjualan per Kasir</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Ringkasan penjualan tiap kasir pada periode tertentu</p>
                  </div>
                  <ExportButtons
                    type="sales-per-cashier"
                    params={{ dateFrom: spcFrom || today, dateTo: spcTo || today }}
                    disabled={!spc || spc.cashiers.length === 0}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={spcFrom} onChange={(e) => setSpcFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={spcTo} onChange={(e) => setSpcTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {spcLoading ? (
                    <Spinner />
                  ) : spc && spc.cashiers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Kasir</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Jumlah Order</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Qty Item</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Total Penjualan</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">DPP</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">SC</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Pajak</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-700">Rata-rata/Order</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {spc.cashiers.map((c) => (
                            <tr key={c.cashierId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900 font-medium">{c.cashierName}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{c.totalOrders}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{c.totalItems}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.totalRevenue)}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.dpp)}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.serviceCharge)}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.tax)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.avgOrderValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                          <tr>
                            <td className="px-4 py-3 text-gray-900">Total</td>
                            <td className="px-4 py-3 text-right text-gray-900">{spc.totals.totalOrders}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{spc.totals.totalItems}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.totalRevenue)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.dpp)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.serviceCharge)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.tax)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">
                              {formatCurrency(spc.totals.totalOrders > 0 ? Math.round(spc.totals.totalRevenue / spc.totals.totalOrders) : 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Tidak ada penjualan pada periode ini</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'inventory-summary' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Ringkasan Stok</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Kondisi stok saat ini (per gudang) + saldo awal &amp; pergerakan pada periode</p>
                  </div>
                  <ExportButtons
                    type="inventory-summary"
                    params={{ dateFrom: invFrom || today, dateTo: invTo || today }}
                    disabled={!inventory || inventory.items.length === 0}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={invFrom} onChange={(e) => setInvFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={invTo} onChange={(e) => setInvTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {inventoryLoading ? (
                    <Spinner />
                  ) : inventory && inventory.items.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Nilai Stok</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(inventory.totals.totalValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Unit</p>
                          <p className="text-xl font-bold text-gray-900">{inventory.totals.totalItems.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Tersedia</p>
                          <p className="text-xl font-bold text-gray-900">{inventory.totals.totalAvailable.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Produk Menipis</p>
                          <p className={`text-xl font-bold ${inventory.lowStockCount > 0 ? 'text-rose-600' : 'text-gray-900'}`}>{inventory.lowStockCount}</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Produk</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Gudang</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Awal</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Stok</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Reserved</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Tersedia</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Min</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">HPP</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Nilai Awal</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Nilai</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {inventoryGroups.map((g) => (
                              <Fragment key={g.productId}>
                                <tr className="bg-blue-50/50">
                                  <td className="px-4 py-3 text-gray-900 font-semibold">
                                    {g.productName}
                                    {g.sku && <span className="text-gray-400 font-normal"> ({g.sku})</span>}
                                    {g.categoryName && <span className="text-gray-400 font-normal"> &middot; {g.categoryName}</span>}
                                  </td>
                                  <td className="px-4 py-3 text-gray-400" />
                                  <td className="px-4 py-3 text-right text-gray-400">{g.openingQuantity}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{g.quantity}</td>
                                  <td className="px-4 py-3 text-right text-gray-500">{g.reserved}</td>
                                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{g.available}</td>
                                  <td className="px-4 py-3 text-right text-gray-400" />
                                  <td className="px-4 py-3 text-right text-gray-400" />
                                  <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(g.openingValue)}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-bold">{formatCurrency(g.value)}</td>
                                  <td className="px-4 py-3 text-gray-400 text-xs">
                                    {(g.movements.in > 0 || g.movements.out > 0) && (
                                      <span>Masuk {g.movements.in} &middot; Keluar {g.movements.out}{g.movements.void > 0 ? ` · Void ${g.movements.void}` : ''}</span>
                                    )}
                                  </td>
                                </tr>
                                {g.rows.map((r) => (
                                  <tr key={`${r.productId}-${r.warehouseId}`} className="hover:bg-gray-50">
                                    <td />
                                    <td className="px-4 py-2 pl-10 text-gray-600">{r.warehouseName || r.warehouseId}</td>
                                    <td className="px-4 py-2 text-right text-gray-500">{r.openingQuantity}</td>
                                    <td className="px-4 py-2 text-right text-gray-700">{r.quantity}</td>
                                    <td className="px-4 py-2 text-right text-gray-500">{r.reservedQuantity}</td>
                                    <td className="px-4 py-2 text-right text-gray-700">{r.availableQuantity}</td>
                                    <td className="px-4 py-2 text-right text-gray-500">{r.minLevel}</td>
                                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(r.costPrice)}</td>
                                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(r.openingValue)}</td>
                                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.value)}</td>
                                    <td className="px-4 py-2">
                                      {r.lowStock && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Menipis</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                            <tr>
                              <td className="px-4 py-3 text-gray-900">Total</td>
                              <td />
                              <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalOpeningItems}</td>
                              <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalItems}</td>
                              <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalReserved}</td>
                              <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalAvailable}</td>
                              <td className="px-4 py-3 text-right text-gray-400" />
                              <td className="px-4 py-3 text-right text-gray-400" />
                              <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(inventory.totals.totalOpeningValue)}</td>
                              <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(inventory.totals.totalValue)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Belum ada data stok</p>
                  )}
                </div>
              </section>
            )}

            {activeReport === 'refunds' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Laporan Refund</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Rincian refund transaksi pada periode tertentu</p>
                  </div>
                  <ExportButtons
                    type="refunds"
                    params={{ dateFrom: refundFrom || today, dateTo: refundTo || today }}
                    disabled={!refunds || refunds.refunds.length === 0}
                  />
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex gap-4">
                    <div>
                      <label className={labelCls}>Dari</label>
                      <input type="date" value={refundFrom} onChange={(e) => setRefundFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sampai</label>
                      <input type="date" value={refundTo} onChange={(e) => setRefundTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {refundsLoading ? (
                    <Spinner />
                  ) : refunds && refunds.refunds.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Refund</p>
                          <p className="text-xl font-bold text-gray-900">{refunds.totalRefunds}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Amount</p>
                          <p className="text-xl font-bold text-red-600">{formatCurrency(refunds.totalAmount)}</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">No. Order</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Tanggal</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Metode</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Kode Ref</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Kasir</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Refunded By</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-700">Alasan</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Jumlah</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-700">Struk</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {refunds.refunds.map((r) => (
                              <tr key={r.refundId} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-900 font-medium">{r.orderNumber}</td>
                                <td className="px-4 py-3 text-gray-500">
                                  {new Date(r.refundedAt).toLocaleString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="px-4 py-3 text-gray-700">{paymentMethodLabel(r.method)}</td>
                                <td className="px-4 py-3 text-gray-500">{refundReference(r)}</td>
                                <td className="px-4 py-3 text-gray-500">{r.cashierName || '-'}</td>
                                <td className="px-4 py-3 text-gray-500">{r.refundedByName || '-'}</td>
                                <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={r.reason}>{r.reason || '-'}</td>
                                <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(r.amount)}</td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setSelectedRefund(r)}
                                    className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                                  >
                                    Struk
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                            <tr>
                              <td className="px-4 py-3 text-gray-900">Total</td>
                              <td colSpan={7} />
                              <td className="px-4 py-3 text-right text-red-600">{formatCurrency(refunds.totalAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Tidak ada refund pada periode ini</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <RefundReceiptModal
        open={!!selectedRefund}
        refund={selectedRefund}
        onClose={() => setSelectedRefund(null)}
      />
    </div>
  );
}
