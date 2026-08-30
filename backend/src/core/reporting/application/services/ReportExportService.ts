import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { ReportService } from './ReportService';
import { MongoCategoryRepository } from '../../../catalog/infrastructure/persistence/MongoCategoryRepository';

export type ReportExportFormat = 'pdf' | 'xlsx';

interface ReportColumn {
  label: string;
  flex: number;
  align: 'left' | 'center' | 'right';
  money?: boolean;
}

type RowStyle = 'group' | 'detail' | 'subtotal';

interface ReportTable {
  columns: ReportColumn[];
  rows: (string | number)[][];
  rowStyles?: RowStyle[];
  totals?: (string | number)[];
}

interface ReportDoc {
  title: string;
  subtitle: string;
  tables: ReportTable[];
}

export interface ReportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const MIME: Record<ReportExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function fmtIDR(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('id-ID');
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'TUNAI',
  qris: 'QRIS',
  transfer: 'TRANSFER',
  card: 'KARTU',
  debit: 'DEBIT',
  credit: 'KREDIT',
  ewallet: 'EWALLET',
};

function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method.toUpperCase();
}

const PAYMENT_METHOD_ORDER = ['cash', 'qris', 'transfer', 'card', 'debit', 'credit', 'ewallet'];

export class ReportExportService {
  constructor(
    private readonly reportService: ReportService,
    private readonly categoryRepository: MongoCategoryRepository,
  ) {}

  async exportDaily(tenantId: string, date: string, format: ReportExportFormat): Promise<ReportFile> {
    const data = await this.reportService.getDailyReport(tenantId, date);

    const doc: ReportDoc = {
      title: 'Laporan Harian',
      subtitle: `Tanggal: ${date}`,
      tables: [
        {
          columns: [
            { label: 'Metrik', flex: 2, align: 'left' },
            { label: 'Nilai', flex: 2, align: 'right', money: true },
          ],
          rows: [
            ['Total Order', data.totalOrders],
            ['Total Pendapatan', data.totalRevenue],
            ['Total Item Terjual', data.totalItems],
            ...(data.totalRounding
              ? [[`Total Pembulatan (${data.totalRounding > 0 ? '+' : '-'})`, Math.abs(data.totalRounding)] as (string | number)[]]
              : []),
          ],
        },
        {
          columns: [
            { label: 'Metode Pembayaran', flex: 2, align: 'left' },
            { label: 'Nominal', flex: 2, align: 'right', money: true },
          ],
          rows: Object.entries(data.paymentBreakdown ?? {}).map(([m, v]) => [m, v as number]),
          totals: ['Total', data.totalRevenue],
        },
        {
          columns: [
            { label: 'Produk', flex: 3, align: 'left' },
            { label: 'Qty', flex: 1, align: 'center' },
            { label: 'Pendapatan', flex: 2, align: 'right', money: true },
          ],
          rows: (data.topProducts ?? []).map((p: { name: string; total: number; revenue: number }) => [
            p.name,
            p.total,
            p.revenue,
          ]),
        },
      ],
    };

    return this.build(doc, format, `laporan-harian-${date}`);
  }

  async exportSales(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getSalesReport(tenantId, dateFrom, dateTo);

    const doc: ReportDoc = {
      title: 'Laporan Penjualan',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables: [
        {
          columns: [
            { label: 'Metrik', flex: 2, align: 'left' },
            { label: 'Nilai', flex: 2, align: 'right', money: true },
          ],
          rows: [
            ['Total Order', data.totalOrders],
            ['Total Pendapatan', data.totalRevenue],
            ['Total Item Terjual', data.totalItems],
            ...(data.totalRounding
              ? [[`Total Pembulatan (${data.totalRounding > 0 ? '+' : '-'})`, Math.abs(data.totalRounding)] as (string | number)[]]
              : []),
          ],
        },
        {
          columns: [
            { label: 'No. Order', flex: 2, align: 'left' },
            { label: 'Total', flex: 2, align: 'right', money: true },
          ],
          rows: data.orders.map((o) => [o.orderNumber, o.total + (o.roundingAdjustment ?? 0)]),
          totals: ['Total', data.totalRevenue],
        },
        {
          columns: [
            { label: 'Kategori', flex: 3, align: 'left' },
            { label: 'Qty', flex: 1, align: 'center' },
            { label: 'Pendapatan', flex: 2, align: 'right', money: true },
          ],
          rows: (data.salesByCategory ?? []).map((c: { categoryId: string | null; totalItems: number; totalRevenue: number }) => [
            c.categoryId ?? 'Tanpa kategori',
            c.totalItems,
            c.totalRevenue,
          ]),
        },
        {
          columns: [
            { label: 'Produk', flex: 3, align: 'left' },
            { label: 'Qty', flex: 1, align: 'center' },
            { label: 'Pendapatan', flex: 2, align: 'right', money: true },
          ],
          rows: (data.topProducts ?? []).map((p: { name: string; total: number; revenue: number }) => [
            p.name,
            p.total,
            p.revenue,
          ]),
        },
      ],
    };

    return this.build(doc, format, `laporan-penjualan-${dateFrom}-${dateTo}`);
  }

  async exportFinance(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getFinanceReport(tenantId, dateFrom, dateTo);
    const categories = await this.categoryRepository.findByTenant(tenantId);
    const nameMap = new Map(categories.map((c) => [c.serialize().id, c.serialize().name]));

    const doc: ReportDoc = {
      title: 'Laporan Keuangan',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables: [
        {
          columns: [
            { label: 'Metrik', flex: 2, align: 'left' },
            { label: 'Nilai', flex: 2, align: 'right', money: true },
          ],
          rows: [
            ['Total Order', data.totalOrders],
            ['Total Pendapatan', data.totalRevenue],
            ['Nett (DPP)', data.netRevenue],
            ['Pajak (PPN)', data.totalTax],
            ['Service Charge', data.totalServiceCharge],
            ['Diskon', data.totalDiscount],
            ...(data.totalRounding
              ? [[`Pembulatan (${data.totalRounding > 0 ? '+' : '-'})`, Math.abs(data.totalRounding)] as (string | number)[]]
              : []),
          ],
        },
        {
          columns: [
            { label: 'Kategori', flex: 3, align: 'left' },
            { label: 'Qty', flex: 1, align: 'center' },
            { label: 'Revenue', flex: 2, align: 'right', money: true },
            { label: 'DPP', flex: 2, align: 'right', money: true },
            { label: 'Pajak', flex: 2, align: 'right', money: true },
            { label: 'SC', flex: 2, align: 'right', money: true },
          ],
          rows: data.categories.map((c) => [
            c.categoryId ? nameMap.get(c.categoryId) ?? '—' : 'Tanpa kategori',
            c.totalItems,
            c.revenue,
            c.dpp,
            c.tax,
            c.serviceCharge,
          ]),
        },
      ],
    };

    return this.build(doc, format, `laporan-keuangan-${dateFrom}-${dateTo}`);
  }

  async exportProfitLoss(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getProfitLoss(tenantId, dateFrom, dateTo);

    const rows: (string | number)[][] = [
      ['Total Order', data.totalOrders],
      ['Total Pendapatan', data.totalRevenue],
      ['HPP (Harga Pokok Penjualan)', data.totalCogs],
      ['Laba Kotor', data.grossProfit],
      [`Margin Kotor (${data.grossMarginPct}%)`, `${data.grossMarginPct}%`],
      ['Diskon', data.totalDiscount],
      ['Pajak (PPN)', data.totalTax],
      ['Service Charge', data.totalServiceCharge],
      ...(data.totalRounding
        ? [[`Pembulatan (${data.totalRounding > 0 ? '+' : '-'})`, Math.abs(data.totalRounding)] as (string | number)[]]
        : []),
      ['Laba Bersih', data.netProfit],
    ];

    const doc: ReportDoc = {
      title: 'Laporan Laba Rugi',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo} · HPP dari pergerakan stok keluar periode`,
      tables: [
        {
          columns: [
            { label: 'Metrik', flex: 2.4, align: 'left' },
            { label: 'Nilai', flex: 1.6, align: 'right', money: true },
          ],
          rows,
          rowStyles: [...rows.map((_, i) => (i === 3 || i === rows.length - 1 ? 'subtotal' : 'detail'))],
          totals: ['Laba Bersih', data.netProfit],
        },
      ],
    };

    return this.build(doc, format, `laporan-laba-rugi-${dateFrom}-${dateTo}`);
  }

  async exportSalesPerProduct(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const result = await this.reportService.getSalesPerProduct(tenantId, dateFrom, dateTo);
    const rows: Array<{
      productId: string;
      productName: string;
      quantity: number;
      totalSales: number;
      dpp: number;
      serviceCharge: number;
      tax: number;
      transactions?: Array<{
        orderId: string;
        quantity: number;
        unitPrice: number;
        dpp: number;
        serviceCharge: number;
        tax: number;
      }>;
    }> = result.rows;
    const totalRounding = result.totalRounding ?? 0;

    const totals = rows.reduce(
      (acc, r) => ({
        quantity: acc.quantity + r.quantity,
        totalSales: acc.totalSales + r.totalSales,
        dpp: acc.dpp + r.dpp,
        serviceCharge: acc.serviceCharge + r.serviceCharge,
        tax: acc.tax + r.tax,
      }),
      { quantity: 0, totalSales: 0, dpp: 0, serviceCharge: 0, tax: 0 },
    );
    const grandTotal = totals.totalSales + totals.serviceCharge + totals.tax + totalRounding;

    const tableRows: (string | number)[][] = [];
    const tableStyles: RowStyle[] = [];
    for (const r of rows) {
      tableRows.push([
        r.productName,
        r.quantity,
        r.totalSales,
        r.dpp,
        r.serviceCharge,
        r.tax,
        '',
        r.totalSales + r.serviceCharge + r.tax,
      ]);
      tableStyles.push('group');

      for (const tx of r.transactions ?? []) {
        const txSales = tx.unitPrice * tx.quantity;
        tableRows.push([
          `   ${tx.orderId}`,
          tx.quantity,
          txSales,
          tx.dpp,
          tx.serviceCharge,
          tx.tax,
          '',
          txSales + tx.serviceCharge + tx.tax,
        ]);
        tableStyles.push('detail');
      }

      tableRows.push([
        `Subtotal ${r.productName}`,
        r.quantity,
        r.totalSales,
        r.dpp,
        r.serviceCharge,
        r.tax,
        '',
        r.totalSales + r.serviceCharge + r.tax,
      ]);
      tableStyles.push('subtotal');
    }

    const doc: ReportDoc = {
      title: 'Penjualan per Produk',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables: [
        {
          columns: [
            { label: 'Produk', flex: 3, align: 'left' },
            { label: 'Qty', flex: 1, align: 'center' },
            { label: 'Total Penjualan', flex: 2, align: 'right', money: true },
            { label: 'DPP', flex: 2, align: 'right', money: true },
            { label: 'SC', flex: 2, align: 'right', money: true },
            { label: 'Pajak', flex: 2, align: 'right', money: true },
            { label: 'Pembulatan', flex: 2, align: 'right', money: true },
            { label: 'Grand Total', flex: 2, align: 'right', money: true },
          ],
          rows: tableRows,
          rowStyles: tableStyles,
          totals: [
            'Total',
            totals.quantity,
            totals.totalSales,
            totals.dpp,
            totals.serviceCharge,
            totals.tax,
            totalRounding,
            grandTotal,
          ],
        },
      ],
    };

    return this.build(doc, format, `penjualan-per-produk-${dateFrom}-${dateTo}`);
  }

  async exportCashierReceipts(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getCashierReceiptsReport(tenantId, dateFrom, dateTo);
    const cashiers: Array<{
      cashierId: string;
      cashierName: string;
      methods: Array<{ method: string; total: number; count: number }>;
      total: number;
      totalTransactions: number;
    }> = data.cashiers;
    const totals: {
      total: number;
      totalTransactions: number;
      methods: Array<{ method: string; total: number }>;
    } = data.totals;

    const methodKeys = PAYMENT_METHOD_ORDER.filter(
      (m) =>
        cashiers.some((c) => c.methods.some((x) => x.method === m)) ||
        totals.methods.some((x) => x.method === m),
    );

    const amountOf = (methods: Array<{ method: string; total: number }>, method: string) =>
      methods.find((m) => m.method === method)?.total ?? 0;
    const countOf = (methods: Array<{ method: string; count: number }>, method: string) =>
      methods.find((m) => m.method === method)?.count ?? 0;

    const columns: ReportColumn[] = [
      { label: 'Kasir', flex: 3, align: 'left' },
      { label: 'Transaksi', flex: 1, align: 'center' },
      ...methodKeys.map((m) => ({ label: paymentLabel(m), flex: 2, align: 'right' as const, money: true })),
      { label: 'Total', flex: 2, align: 'right' as const, money: true },
    ];

    const tableRows: (string | number)[][] = [];
    const tableStyles: RowStyle[] = [];
    for (const c of cashiers) {
      tableRows.push([
        c.cashierName,
        c.totalTransactions,
        ...methodKeys.map((m) => amountOf(c.methods, m)),
        c.total,
      ]);
      tableStyles.push('group');

      for (const m of c.methods) {
        tableRows.push([
          `   ${paymentLabel(m.method)}`,
          countOf(c.methods, m.method),
          ...methodKeys.map((k) => (k === m.method ? m.total : '')),
          '',
        ]);
        tableStyles.push('detail');
      }

      tableRows.push([
        `Subtotal ${c.cashierName}`,
        c.totalTransactions,
        ...methodKeys.map((m) => amountOf(c.methods, m)),
        c.total,
      ]);
      tableStyles.push('subtotal');
    }

    const totalsRow: (string | number)[] = [
      'Total',
      totals.totalTransactions,
      ...methodKeys.map((m) => amountOf(totals.methods, m)),
      totals.total,
    ];

    const doc: ReportDoc = {
      title: 'Penerimaan per Kasir',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables: [
        {
          columns,
          rows: tableRows,
          rowStyles: tableStyles,
          totals: totalsRow,
        },
      ],
    };

    return this.build(doc, format, `penerimaan-per-kasir-${dateFrom}-${dateTo}`);
  }

  async exportSalesPerCashier(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getSalesPerCashierReport(tenantId, dateFrom, dateTo);
    const totals = data.totals;

    const doc: ReportDoc = {
      title: 'Penjualan per Kasir',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables: [
        {
          columns: [
            { label: 'Kasir', flex: 3, align: 'left' },
            { label: 'Jumlah Order', flex: 1, align: 'center' },
            { label: 'Qty Item', flex: 1, align: 'center' },
            { label: 'Total Penjualan', flex: 2, align: 'right', money: true },
            { label: 'DPP', flex: 2, align: 'right', money: true },
            { label: 'SC', flex: 2, align: 'right', money: true },
            { label: 'Pajak', flex: 2, align: 'right', money: true },
            { label: 'Rata-rata/Order', flex: 2, align: 'right', money: true },
          ],
          rows: data.cashiers.map((c) => [
            c.cashierName,
            c.totalOrders,
            c.totalItems,
            c.totalRevenue,
            c.dpp,
            c.serviceCharge,
            c.tax,
            c.avgOrderValue,
          ]),
          totals: [
            'Total',
            totals.totalOrders,
            totals.totalItems,
            totals.totalRevenue,
            totals.dpp,
            totals.serviceCharge,
            totals.tax,
            totals.totalOrders > 0 ? Math.round(totals.totalRevenue / totals.totalOrders) : 0,
          ],
        },
      ],
    };

    return this.build(doc, format, `penjualan-per-kasir-${dateFrom}-${dateTo}`);
  }

  async exportPaymentReconciliation(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getPaymentReconciliation(tenantId, dateFrom, dateTo);
    const rows: (string | number)[][] = [];
    const styles: RowStyle[] = [];
    for (const item of data.items) {
      rows.push([
        paymentLabel(item.method),
        item.paymentCount,
        item.paymentTotal,
        item.orderCount,
        item.orderTotal,
        item.difference,
      ]);
      styles.push(item.difference === 0 ? ('group' as const) : ('group' as const));
    }

    const tables: ReportTable[] = [
      {
        columns: [
          { label: 'Metode', flex: 2, align: 'left' },
          { label: '#', flex: 1, align: 'center' },
          { label: 'Penerimaan (Rp)', flex: 2, align: 'right', money: true },
          { label: '#', flex: 1, align: 'center' },
          { label: 'Order (Rp)', flex: 2, align: 'right', money: true },
          { label: 'Selisih', flex: 2, align: 'right', money: true },
        ],
        rows,
        rowStyles: styles,
        totals: [
          'Total',
          data.totals.paymentCount,
          data.totals.paymentTotal,
          data.totals.orderCount,
          data.totals.orderTotal,
          data.totals.difference,
        ],
      },
    ];

    if (data.totals.pendingCount > 0) {
      tables.push({
        columns: [
          { label: 'Transfer Menunggu Konfirmasi', flex: 3, align: 'left' },
          { label: 'Jumlah', flex: 1, align: 'center' },
          { label: 'Total (Rp)', flex: 2, align: 'right', money: true },
        ],
        rows: [
          ['transfer', data.totals.pendingCount, data.totals.pendingTotal],
        ],
        totals: ['Total', data.totals.pendingCount, data.totals.pendingTotal],
      });
    }

    const doc: ReportDoc = {
      title: 'Rekonsiliasi Pembayaran',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables,
    };

    return this.build(doc, format, `rekonsiliasi-pembayaran-${dateFrom}-${dateTo}`);
  }

  async exportInventorySummary(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string,
    format: ReportExportFormat = 'pdf',
  ): Promise<ReportFile> {
    const data = await this.reportService.getInventorySummary(tenantId, dateFrom, dateTo);
    const dateLabel = dateFrom && dateTo ? `Periode: ${dateFrom} s/d ${dateTo}` : 'Kondisi stok saat ini';

    interface Item {
      productId: string;
      warehouseId: string;
      warehouseName?: string;
      productName?: string;
      sku?: string;
      categoryName?: string;
      quantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      minLevel: number;
      costPrice: number;
      value: number;
      openingQuantity: number;
      openingValue: number;
      lowStock: boolean;
    }
    const items = data.items as Item[];

    const byProduct = new Map<string, Item[]>();
    for (const it of items) {
      const arr = byProduct.get(it.productId) ?? [];
      arr.push(it);
      byProduct.set(it.productId, arr);
    }

    const tableRows: (string | number)[][] = [];
    const tableStyles: RowStyle[] = [];
    let totalQty = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let totalValue = 0;
    let totalOpeningQty = 0;
    let totalOpeningValue = 0;

    for (const [, rows] of byProduct) {
      const first = rows[0];
      const qtySum = rows.reduce((s, r) => s + r.quantity, 0);
      const resSum = rows.reduce((s, r) => s + r.reservedQuantity, 0);
      const availSum = rows.reduce((s, r) => s + r.availableQuantity, 0);
      const valSum = rows.reduce((s, r) => s + r.value, 0);
      const openQtySum = rows.reduce((s, r) => s + r.openingQuantity, 0);
      const openValSum = rows.reduce((s, r) => s + r.openingValue, 0);

      tableRows.push([
        `${first.productName || '(tanpa nama)'}${first.sku ? ` (${first.sku})` : ''}${first.categoryName ? ` · ${first.categoryName}` : ''}`,
        '',
        openQtySum,
        qtySum,
        resSum,
        availSum,
        '',
        '',
        openValSum,
        valSum,
        '',
      ]);
      tableStyles.push('group');

      for (const r of rows) {
        tableRows.push([
          `   ${r.warehouseName || r.warehouseId}`,
          '',
          r.openingQuantity,
          r.quantity,
          r.reservedQuantity,
          r.availableQuantity,
          r.minLevel,
          r.costPrice,
          r.openingValue,
          r.value,
          r.lowStock ? 'MENIPIS' : '',
        ]);
        tableStyles.push('detail');
      }

      tableRows.push([
        `Subtotal ${first.productName || '(tanpa nama)'}`,
        '',
        openQtySum,
        qtySum,
        resSum,
        availSum,
        '',
        '',
        openValSum,
        valSum,
        '',
      ]);
      tableStyles.push('subtotal');

      totalQty += qtySum;
      totalReserved += resSum;
      totalAvailable += availSum;
      totalValue += valSum;
      totalOpeningQty += openQtySum;
      totalOpeningValue += openValSum;
    }

    const doc: ReportDoc = {
      title: 'Ringkasan Stok',
      subtitle: `${dateLabel} · ${data.lowStockCount} produk menipis`,
      tables: [
        {
          columns: [
            { label: 'Produk', flex: 3, align: 'left' },
            { label: 'Gudang', flex: 1.8, align: 'left' },
            { label: 'Awal', flex: 1, align: 'center' },
            { label: 'Stok', flex: 1, align: 'center' },
            { label: 'Reserved', flex: 1, align: 'center' },
            { label: 'Tersedia', flex: 1, align: 'center' },
            { label: 'Min', flex: 1, align: 'center' },
            { label: 'HPP', flex: 1.5, align: 'right', money: true },
            { label: 'Nilai Awal', flex: 1.5, align: 'right', money: true },
            { label: 'Nilai', flex: 1.5, align: 'right', money: true },
            { label: 'Status', flex: 1.2, align: 'left' },
          ],
          rows: tableRows,
          rowStyles: tableStyles,
          totals: [
            'Total',
            '',
            Math.round(totalOpeningQty * 100) / 100,
            totalQty,
            totalReserved,
            totalAvailable,
            '',
            '',
            Math.round(totalOpeningValue * 100) / 100,
            Math.round(totalValue * 100) / 100,
            '',
          ],
        },
      ],
    };

    return this.build(doc, format, `laporan-ringkasan-stok-${dateTo ?? 'now'}`);
  }

  async exportRefunds(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const data = await this.reportService.getRefundReport(tenantId, dateFrom, dateTo);

    const doc: ReportDoc = {
      title: 'Laporan Refund',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo}`,
      tables: [
        {
          columns: [
            { label: 'No. Refund', flex: 2, align: 'left' },
            { label: 'No. Order', flex: 2, align: 'left' },
            { label: 'Tanggal', flex: 2, align: 'left' },
            { label: 'Metode', flex: 1, align: 'left' },
            { label: 'Kode Ref', flex: 2, align: 'left' },
            { label: 'Kasir', flex: 2, align: 'left' },
            { label: 'Refunded By', flex: 2, align: 'left' },
            { label: 'Jumlah', flex: 2, align: 'right', money: true },
          ],
          rows: data.refunds.map((r) => [
            r.refundId,
            r.orderNumber,
            new Date(r.refundedAt).toISOString().slice(0, 16).replace('T', ' '),
            paymentLabel(r.method),
            r.method === 'cash' ? '-' : (r.referenceNumber || r.provider || r.cardLastFour || '-'),
            r.cashierName || '-',
            r.refundedByName || '-',
            r.amount,
          ]),
          totals: ['Total', data.totalRefunds, '', '', '', '', '', data.totalAmount],
        },
      ],
    };

    return this.build(doc, format, `laporan-refund-${dateFrom}-${dateTo}`);
  }

  async refundReceiptPdf(tenantId: string, refundId: string): Promise<Buffer> {
    const r = await this.reportService.getRefundDetail(tenantId, refundId);
    if (!r) throw new Error('Refund not found');

    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ size: [230, 700], margin: 10 });
      const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      const line = (txt: string, opts?: { bold?: boolean; align?: 'left' | 'center' | 'right' }) => {
        pdf.font(opts?.bold ? 'Courier-Bold' : 'Courier').fontSize(8).fillColor('#111827');
        pdf.text(txt, { align: opts?.align ?? 'left', lineGap: 1 });
      };
      const sep = () => line('=====================================');

      sep();
      line('STRUK REFUND', { bold: true, align: 'center' });
      sep();
      line(`No. Refund : ${r.refundId}`);
      line(`No. Order  : ${r.orderNumber}`);
      line(`Tanggal    : ${new Date(r.refundedAt).toLocaleString('id-ID')}`);
      line(`Kasir      : ${r.cashierName || '-'}`);
      sep();
      line('Pembayaran : ' + paymentLabel(r.method));
      if (r.method !== 'cash') {
        line(`Kode Ref   : ${r.referenceNumber || r.provider || r.cardLastFour || '-'}`);
      }
      line(`Alasan     : ${r.reason || '-'}`);
      sep();
      line('ITEM', { bold: true });
      for (const it of r.orderItems ?? []) {
        line(`${it.productName || '-'} x${it.quantity}`);
        line(`  ${fmtIDR(it.unitPrice * it.quantity)}`);
      }
      sep();
      line(`Total Order: ${fmtIDR(r.orderTotal + (r.roundingAdjustment ?? 0))}`);
      line(`DIRUNDING   : ${fmtIDR(r.amount)}`, { bold: true });
      sep();
      line(`Refunded by: ${r.refundedByName || '-'}`);
      pdf.moveDown(0.5);

      pdf.end();
    });
  }

  private async build(doc: ReportDoc, format: ReportExportFormat, baseName: string): Promise<ReportFile> {
    const buffer = format === 'pdf' ? await this.buildPdf(doc) : await this.buildXlsx(doc);
    return {
      buffer,
      filename: `${baseName}.${format}`,
      contentType: MIME[format],
    };
  }

  private buildPdf(doc: ReportDoc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      pdf.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(doc.title, { align: 'center' });
      pdf.font('Helvetica').fontSize(10).fillColor('#6b7280').text(doc.subtitle, { align: 'center' });
      pdf.moveDown(1.2);

      for (const table of doc.tables) {
        this.drawTable(pdf, table);
        pdf.moveDown(0.8);
      }

      pdf.end();
    });
  }

  private drawTable(pdf: PDFKit.PDFDocument, table: ReportTable): void {
    const pageWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const totalFlex = table.columns.reduce((sum, c) => sum + c.flex, 0);
    const colW = table.columns.map((c) => (c.flex / totalFlex) * pageWidth);

    const xs: number[] = [];
    let x = pdf.page.margins.left;
    for (const w of colW) {
      xs.push(x);
      x += w;
    }

    const alignments = table.columns.map((c) => c.align);

    const ensureSpace = (height: number) => {
      if (pdf.y + height > pdf.page.height - pdf.page.margins.bottom) {
        pdf.addPage();
        this.drawHeaderRow(pdf, xs, colW, table.columns);
      }
    };

    this.drawHeaderRow(pdf, xs, colW, table.columns);

    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const style = table.rowStyles?.[i];
      const cells = row.map((v, idx) => this.formatCell(v, table.columns[idx]));
      const h = this.cellHeight(pdf, cells, colW, style);
      ensureSpace(h);

      const opts =
        style === 'group'
          ? { bold: true, bg: '#eef2ff' }
          : style === 'subtotal'
            ? { bold: true, bg: '#f9fafb' }
            : style === 'detail'
              ? { color: '#6b7280', fontSize: 8 }
              : undefined;
      this.drawRow(pdf, xs, colW, cells, h, alignments, opts);
    }

    if (table.totals) {
      const cells = table.totals.map((v, i) => this.formatCell(v, table.columns[i]));
      const h = this.cellHeight(pdf, cells, colW);
      ensureSpace(h);
      this.drawRow(pdf, xs, colW, cells, h, alignments, { bold: true, bg: '#eef2ff' });
    }
  }

  private drawHeaderRow(
    pdf: PDFKit.PDFDocument,
    xs: number[],
    colW: number[],
    columns: ReportColumn[],
  ): void {
    const labels = columns.map((c) => c.label);
    const h = this.cellHeight(pdf, labels, colW);
    const top = pdf.y;

    pdf.save();
    pdf.rect(xs[0], top, xs[xs.length - 1] - xs[0] + colW[colW.length - 1], h).fill('#2176D2');
    labels.forEach((label, i) => {
      pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      pdf.text(label, xs[i] + 4, top + 3, { width: colW[i] - 8, align: columns[i].align });
    });
    pdf.restore();

    pdf.y = top + h;
  }

  private drawRow(
    pdf: PDFKit.PDFDocument,
    xs: number[],
    colW: number[],
    cells: string[],
    h: number,
    alignments: Array<'left' | 'center' | 'right'>,
    opts?: { bold?: boolean; bg?: string; fontSize?: number; color?: string },
  ): void {
    const top = pdf.y;

    if (opts?.bg) {
      pdf.save();
      pdf.rect(xs[0], top, xs[xs.length - 1] - xs[0] + colW[colW.length - 1], h).fill(opts.bg);
      pdf.restore();
    }

    const fontSize = opts?.fontSize ?? 9;
    const color = opts?.color ?? '#1f2937';

    cells.forEach((cell, i) => {
      pdf.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color);
      pdf.text(cell, xs[i] + 4, top + 3, { width: colW[i] - 8, align: alignments[i] });
    });

    pdf.y = top + h;
    pdf.save();
    pdf.moveTo(xs[0], pdf.y - 0.5).lineTo(xs[xs.length - 1] + colW[colW.length - 1], pdf.y - 0.5)
      .lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    pdf.restore();
  }

  private cellHeight(pdf: PDFKit.PDFDocument, cells: string[], colW: number[], style?: RowStyle): number {
    const fontSize = style === 'detail' ? 8 : 9;
    pdf.font('Helvetica').fontSize(fontSize);
    let max = 18;
    cells.forEach((cell, i) => {
      const h = pdf.heightOfString(cell, { width: colW[i] - 8 });
      max = Math.max(max, h + 6);
    });
    return max;
  }

  private formatCell(v: string | number, col: ReportColumn): string {
    if (typeof v === 'number') {
      return col.money ? fmtIDR(v) : fmtNum(v);
    }
    return String(v);
  }

  private async buildXlsx(doc: ReportDoc): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Laporan');

    const colCount = Math.max(...doc.tables.map((t) => t.columns.length));
    let row = 1;

    ws.mergeCells(row, 1, row, colCount);
    const titleCell = ws.getCell(row, 1);
    titleCell.value = doc.title;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    row += 1;

    ws.mergeCells(row, 1, row, colCount);
    const subCell = ws.getCell(row, 1);
    subCell.value = doc.subtitle;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    subCell.alignment = { horizontal: 'center' };
    row += 2;

    for (const table of doc.tables) {
      const headerRow = ws.getRow(row);
      table.columns.forEach((c, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = c.label;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2176D2' } };
        cell.alignment = { horizontal: c.align, vertical: 'middle' };
      });
      headerRow.height = 20;
      row += 1;

      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        const style = table.rowStyles?.[i];
        const dataRow = ws.getRow(row);
        r.forEach((v, idx) => {
          const cell = dataRow.getCell(idx + 1);
          cell.value = v;
          this.applyCellStyle(cell, v, table.columns[idx]);
        });

        if (style === 'group') {
          for (let c = 1; c <= table.columns.length; c++) {
            const cell = dataRow.getCell(c);
            cell.font = { bold: true, color: { argb: 'FF1F2937' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
          }
        } else if (style === 'detail') {
          for (let c = 1; c <= table.columns.length; c++) {
            dataRow.getCell(c).font = { size: 9, color: { argb: 'FF6B7280' } };
          }
        } else if (style === 'subtotal') {
          for (let c = 1; c <= table.columns.length; c++) {
            const cell = dataRow.getCell(c);
            cell.font = { bold: true, color: { argb: 'FF1F2937' } };
            cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
          }
        }

        row += 1;
      }

      if (table.rowStyles?.length) {
        const dataStart = row - table.rows.length;
        table.rowStyles.forEach((style, i) => {
          if (style === 'detail') ws.getRow(dataStart + i).outlineLevel = 1;
        });
      }

      if (table.totals) {
        const totalRow = ws.getRow(row);
        table.totals.forEach((v, i) => {
          const cell = totalRow.getCell(i + 1);
          cell.value = v;
          cell.font = { bold: true };
          this.applyCellStyle(cell, v, table.columns[i]);
        });
        row += 2;
      } else {
        row += 1;
      }
    }

    const flexes: number[] = [];
    for (const t of doc.tables) {
      t.columns.forEach((c, i) => {
        flexes[i] = Math.max(flexes[i] ?? 0, c.flex);
      });
    }
    flexes.forEach((f, i) => {
      ws.getColumn(i + 1).width = Math.min(40, Math.max(10, f * 10));
    });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private applyCellStyle(cell: ExcelJS.Cell, v: string | number, col: ReportColumn): void {
    if (typeof v === 'number') {
      cell.numFmt = col.money ? '"Rp"#,##0' : '#,##0';
      cell.alignment = { horizontal: 'right' };
    } else {
      cell.alignment = { horizontal: col.align };
    }
  }
}
