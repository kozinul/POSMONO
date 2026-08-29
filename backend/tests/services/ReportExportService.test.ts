import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { ReportExportService } from '../../src/core/reporting/application/services/ReportExportService';
import { ReportService } from '../../src/core/reporting/application/services/ReportService';
import { MongoCategoryRepository } from '../../src/core/catalog/infrastructure/persistence/MongoCategoryRepository';

const TENANT_ID = 'tenant-test-1';

function createMockReportService() {
  const service = {
    getDailyReport: vi.fn(),
    getSalesReport: vi.fn(),
    getFinanceReport: vi.fn(),
    getSalesPerProduct: vi.fn(),
    getCashierReceiptsReport: vi.fn(),
    getSalesPerCashierReport: vi.fn(),
    getInventorySummary: vi.fn(),
  } as unknown as ReportService;
  return service;
}

function createMockCategoryRepo() {
  const repo = {
    findByTenant: vi.fn(),
  } as unknown as MongoCategoryRepository;
  return repo;
}

describe('ReportExportService', () => {
  const reportService = createMockReportService();
  const categoryRepo = createMockCategoryRepo();
  const service = new ReportExportService(reportService, categoryRepo);

  it('generates a valid PDF for daily report', async () => {
    vi.mocked(reportService.getDailyReport).mockResolvedValue({
      date: '2026-08-06',
      totalOrders: 5,
      totalRevenue: 250_000,
      totalItems: 9,
      paymentBreakdown: { cash: 200_000, qris: 50_000 },
      topProducts: [{ productId: 'p1', name: 'Kopi Hitam', total: 4, revenue: 60_000 }],
      shifts: [],
    });

    const file = await service.exportDaily(TENANT_ID, '2026-08-06', 'pdf');

    expect(file.filename).toBe('laporan-harian-2026-08-06.pdf');
    expect(file.contentType).toBe('application/pdf');
    expect(file.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates a valid xlsx for daily report', async () => {
    vi.mocked(reportService.getDailyReport).mockResolvedValue({
      date: '2026-08-06',
      totalOrders: 3,
      totalRevenue: 120_000,
      totalItems: 5,
      paymentBreakdown: { cash: 120_000 },
      topProducts: [],
      shifts: [],
    });

    const file = await service.exportDaily(TENANT_ID, '2026-08-06', 'xlsx');

    expect(file.filename).toBe('laporan-harian-2026-08-06.xlsx');
    expect(file.contentType).toContain('spreadsheetml');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A1').value).toBe('Laporan Harian');
    expect(ws.getCell('A2').value).toBe('Tanggal: 2026-08-06');
  });

  it('uses category names in finance export', async () => {
    vi.mocked(reportService.getFinanceReport).mockResolvedValue({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-06',
      totalOrders: 12,
      totalRevenue: 1_200_000,
      netRevenue: 1_000_000,
      totalTax: 110_000,
      totalServiceCharge: 90_000,
      totalDiscount: 50_000,
      categories: [
        {
          categoryId: 'cat-1',
          totalOrders: 8,
          totalItems: 20,
          revenue: 900_000,
          dpp: 750_000,
          tax: 80_000,
          serviceCharge: 70_000,
        },
      ],
    });
    vi.mocked(categoryRepo.findByTenant).mockResolvedValue([
      { serialize: () => ({ id: 'cat-1', name: 'Makanan Utama' }) } as any,
    ]);

    const file = await service.exportFinance(TENANT_ID, '2026-08-01', '2026-08-06', 'pdf');

    expect(file.filename).toBe('laporan-keuangan-2026-08-01-2026-08-06.pdf');
    expect(file.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(categoryRepo.findByTenant).toHaveBeenCalledWith(TENANT_ID);
  });

  it('generates sales per product xlsx with totals row and transaction details', async () => {
    vi.mocked(reportService.getSalesPerProduct).mockResolvedValue({
      rows: [
        {
          productId: 'p1',
          productName: 'Kopi Susu',
          quantity: 2,
          totalSales: 40_000,
          dpp: 36_400,
          serviceCharge: 0,
          tax: 3_600,
          transactions: [
            { orderId: 'ORD-1', quantity: 1, unitPrice: 20_000, dpp: 18_200, serviceCharge: 0, tax: 1_800 },
            { orderId: 'ORD-2', quantity: 1, unitPrice: 20_000, dpp: 18_200, serviceCharge: 0, tax: 1_800 },
          ],
        },
      ],
      totalRounding: 500,
    });

    const file = await service.exportSalesPerProduct(TENANT_ID, '2026-08-01', '2026-08-06', 'xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A1').value).toBe('Penjualan per Produk');

    const values: string[] = [];
    ws.eachRow((r) => values.push(r.getCell(1).value?.toString() ?? ''));
    expect(values).toContain('Kopi Susu');
    expect(values).toContain('Total');

    const headerValues: string[] = [];
    const headerRow = ws.getRow(4);
    for (let i = 1; i <= 8; i++) headerValues.push(headerRow.getCell(i).value as string);
    expect(headerValues).toContain('Pembulatan');
    expect(headerValues).toContain('Grand Total');

    const productRow = ws.getRow(5);
    expect(productRow.getCell(1).value).toBe('Kopi Susu');
    expect(productRow.getCell(2).value).toBe(2);
    expect(productRow.getCell(8).value).toBe(43_600);

    const detail1 = ws.getRow(6);
    expect(detail1.getCell(1).value).toContain('ORD-1');
    expect(detail1.getCell(2).value).toBe(1);
    expect(detail1.getCell(8).value).toBe(21_800);

    const detail2 = ws.getRow(7);
    expect(detail2.getCell(1).value).toContain('ORD-2');
    expect(detail2.getCell(2).value).toBe(1);
    expect(detail2.getCell(8).value).toBe(21_800);

    const subtotalRow = ws.getRow(8);
    expect(subtotalRow.getCell(1).value).toBe('Subtotal Kopi Susu');
    expect(subtotalRow.getCell(2).value).toBe(2);
    expect(subtotalRow.getCell(8).value).toBe(43_600);

    const totalRow = ws.getRow(9);
    expect(totalRow.getCell(2).value).toBe(2);
    expect(totalRow.getCell(7).value).toBe(500);
    expect(totalRow.getCell(8).value).toBe(44_100);

    expect(ws.getRow(6).outlineLevel).toBe(1);
    expect(ws.getRow(7).outlineLevel).toBe(1);
    expect(ws.getRow(5).outlineLevel).toBe(0);
    expect(ws.getRow(8).outlineLevel).toBe(0);
  });

  it('generates cashier receipts xlsx grouped per cashier with method columns', async () => {
    vi.mocked(reportService.getCashierReceiptsReport).mockResolvedValue({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-06',
      cashiers: [
        {
          cashierId: 'c1',
          cashierName: 'Kasir 1',
          methods: [
            { method: 'cash', total: 200_000, count: 3 },
            { method: 'qris', total: 100_000, count: 1 },
          ],
          total: 300_000,
          totalTransactions: 4,
        },
      ],
      totals: {
        total: 300_000,
        totalTransactions: 4,
        methods: [
          { method: 'cash', total: 200_000 },
          { method: 'qris', total: 100_000 },
        ],
      },
    });

    const file = await service.exportCashierReceipts(TENANT_ID, '2026-08-01', '2026-08-06', 'xlsx');

    expect(file.filename).toBe('penerimaan-per-kasir-2026-08-01-2026-08-06.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A1').value).toBe('Penerimaan per Kasir');

    const header = ws.getRow(4);
    const headerVals: string[] = [];
    for (let i = 1; i <= 5; i++) headerVals.push(header.getCell(i).value as string);
    expect(headerVals).toContain('TUNAI');
    expect(headerVals).toContain('QRIS');
    expect(headerVals).toContain('Total');

    const groupRow = ws.getRow(5);
    expect(groupRow.getCell(1).value).toBe('Kasir 1');
    expect(groupRow.getCell(2).value).toBe(4);
    expect(groupRow.getCell(3).value).toBe(200_000);
    expect(groupRow.getCell(4).value).toBe(100_000);
    expect(groupRow.getCell(5).value).toBe(300_000);

    const detailRow = ws.getRow(6);
    expect(detailRow.getCell(1).value).toContain('TUNAI');
    expect(detailRow.getCell(3).value).toBe(200_000);

    const detail2 = ws.getRow(7);
    expect(detail2.getCell(1).value).toContain('QRIS');
    expect(detail2.getCell(4).value).toBe(100_000);

    const subtotalRow = ws.getRow(8);
    expect(subtotalRow.getCell(1).value).toBe('Subtotal Kasir 1');

    const totalsRow = ws.getRow(9);
    expect(totalsRow.getCell(1).value).toBe('Total');
    expect(totalsRow.getCell(3).value).toBe(200_000);
    expect(totalsRow.getCell(4).value).toBe(100_000);
    expect(totalsRow.getCell(5).value).toBe(300_000);

    expect(ws.getRow(6).outlineLevel).toBe(1);
    expect(ws.getRow(5).outlineLevel).toBe(0);
  });

  it('generates sales per cashier xlsx with totals', async () => {
    vi.mocked(reportService.getSalesPerCashierReport).mockResolvedValue({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-06',
      cashiers: [
        {
          cashierId: 'c1',
          cashierName: 'Kasir 1',
          totalOrders: 5,
          totalItems: 12,
          totalRevenue: 400_000,
          dpp: 360_000,
          serviceCharge: 10_000,
          tax: 30_000,
          avgOrderValue: 80_000,
        },
      ],
      totals: {
        totalOrders: 5,
        totalItems: 12,
        totalRevenue: 400_000,
        dpp: 360_000,
        serviceCharge: 10_000,
        tax: 30_000,
      },
    });

    const file = await service.exportSalesPerCashier(TENANT_ID, '2026-08-01', '2026-08-06', 'xlsx');

    expect(file.filename).toBe('penjualan-per-kasir-2026-08-01-2026-08-06.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A1').value).toBe('Penjualan per Kasir');

    const dataRow = ws.getRow(5);
    expect(dataRow.getCell(1).value).toBe('Kasir 1');
    expect(dataRow.getCell(2).value).toBe(5);
    expect(dataRow.getCell(3).value).toBe(12);
    expect(dataRow.getCell(4).value).toBe(400_000);
    expect(dataRow.getCell(8).value).toBe(80_000);

    const totalsRow = ws.getRow(6);
    expect(totalsRow.getCell(2).value).toBe(5);
    expect(totalsRow.getCell(4).value).toBe(400_000);
    expect(totalsRow.getCell(8).value).toBe(80_000);
  });

  it('generates inventory summary xlsx grouped per product with HPP/nilai/status', async () => {
    vi.mocked(reportService.getInventorySummary).mockResolvedValue({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      generatedAt: new Date().toISOString(),
      items: [
        {
          productId: 'p1',
          warehouseId: 'wh-1',
          warehouseName: 'Gudang Utama',
          productName: 'Kopi Susu',
          sku: 'KS-01',
          categoryName: 'Minuman',
          quantity: 20,
          reservedQuantity: 4,
          availableQuantity: 16,
          minLevel: 5,
          maxLevel: 100,
          costPrice: 5000,
          value: 100000,
          openingQuantity: 15,
          openingReservedQuantity: 4,
          openingAvailableQuantity: 11,
          openingValue: 75000,
          lowStock: false,
          movements: { in: 10, out: 5, adjustment: 0, void: 0, reserve: 0, release: 0 },
        },
      ],
      totals: {
        totalItems: 20,
        totalReserved: 4,
        totalAvailable: 16,
        totalValue: 100000,
        totalOpeningItems: 15,
        totalOpeningValue: 75000,
      },
      lowStockCount: 0,
    });

    const file = await service.exportInventorySummary(TENANT_ID, '2026-08-01', '2026-08-31', 'xlsx');

    expect(file.filename).toBe('laporan-ringkasan-stok-2026-08-31.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A1').value).toBe('Ringkasan Stok');
    expect(ws.getCell('A2').value).toContain('Periode: 2026-08-01');

    const headerRow = ws.getRow(4);
    const headers: string[] = [];
    for (let i = 1; i <= 11; i++) headers.push(headerRow.getCell(i).value as string);
    expect(headers).toContain('Produk');
    expect(headers).toContain('Gudang');
    expect(headers).toContain('Awal');
    expect(headers).toContain('HPP');
    expect(headers).toContain('Nilai');
    expect(headers).toContain('Status');

    const groupRow = ws.getRow(5);
    expect(groupRow.getCell(1).value).toBe('Kopi Susu (KS-01) · Minuman');
    expect(groupRow.getCell(3).value).toBe(15);
    expect(groupRow.getCell(4).value).toBe(20);
    expect(groupRow.getCell(6).value).toBe(16);
    expect(groupRow.getCell(9).value).toBe(75000);
    expect(groupRow.getCell(10).value).toBe(100000);

    const detailRow = ws.getRow(6);
    expect(detailRow.getCell(1).value).toContain('Gudang Utama');
    expect(detailRow.getCell(1).value).not.toContain('Kopi Susu');
    expect(detailRow.getCell(2).value).toBe('');
    expect(detailRow.getCell(3).value).toBe(15);
    expect(detailRow.getCell(4).value).toBe(20);
    expect(detailRow.getCell(7).value).toBe(5);
    expect(detailRow.getCell(8).value).toBe(5000);
    expect(detailRow.getCell(9).value).toBe(75000);
    expect(detailRow.getCell(10).value).toBe(100000);

    const subtotalRow = ws.getRow(7);
    expect(subtotalRow.getCell(1).value).toBe('Subtotal Kopi Susu');
    expect(subtotalRow.getCell(3).value).toBe(15);
    expect(subtotalRow.getCell(4).value).toBe(20);

    const totalsRow = ws.getRow(8);
    expect(totalsRow.getCell(1).value).toBe('Total');
    expect(totalsRow.getCell(3).value).toBe(15);
    expect(totalsRow.getCell(4).value).toBe(20);
    expect(totalsRow.getCell(9).value).toBe(75000);
    expect(totalsRow.getCell(10).value).toBe(100000);

    expect(ws.getRow(6).outlineLevel).toBe(1);
    expect(ws.getRow(5).outlineLevel).toBe(0);
    expect(ws.getRow(7).outlineLevel).toBe(0);
  });

  it('marks low stock and applies low-stock subtitle in inventory summary export', async () => {
    vi.mocked(reportService.getInventorySummary).mockResolvedValue({
      dateFrom: '',
      dateTo: '',
      generatedAt: new Date().toISOString(),
      items: [
        {
          productId: 'p1',
          warehouseId: 'wh-1',
          warehouseName: 'Gudang Utama',
          productName: 'Teh Manis',
          sku: 'TM-01',
          categoryName: 'Minuman',
          quantity: 3,
          reservedQuantity: 0,
          availableQuantity: 3,
          minLevel: 5,
          maxLevel: 100,
          costPrice: 2000,
          value: 6000,
          openingQuantity: 3,
          openingReservedQuantity: 0,
          openingAvailableQuantity: 3,
          openingValue: 6000,
          lowStock: true,
          movements: { in: 0, out: 0, adjustment: 0, void: 0, reserve: 0, release: 0 },
        },
      ],
      totals: {
        totalItems: 3,
        totalReserved: 0,
        totalAvailable: 3,
        totalValue: 6000,
        totalOpeningItems: 3,
        totalOpeningValue: 6000,
      },
      lowStockCount: 1,
    });

    const file = await service.exportInventorySummary(TENANT_ID, undefined, undefined, 'pdf');

    expect(file.filename).toBe('laporan-ringkasan-stok-now.pdf');
    expect(file.buffer.subarray(0, 4).toString()).toBe('%PDF');

    const xlsxFile = await service.exportInventorySummary(TENANT_ID, '2026-08-01', '2026-08-31', 'xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxFile.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A2').value).toContain('1 produk menipis');
    const detailRow = ws.getRow(6);
    expect(detailRow.getCell(11).value).toBe('MENIPIS');
  });
});
