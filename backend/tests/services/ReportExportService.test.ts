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

  it('generates sales per product xlsx with totals row', async () => {
    vi.mocked(reportService.getSalesPerProduct).mockResolvedValue([
      {
        productId: 'p1',
        productName: 'Kopi Susu',
        quantity: 2,
        totalSales: 40_000,
        dpp: 36_400,
        serviceCharge: 0,
        tax: 3_600,
        transactions: [],
      },
    ]);

    const file = await service.exportSalesPerProduct(TENANT_ID, '2026-08-01', '2026-08-06', 'xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.getWorksheet('Laporan');
    expect(ws.getCell('A1').value).toBe('Penjualan per Produk');

    const values: string[] = [];
    ws.eachRow((r) => values.push(r.getCell(1).value?.toString() ?? ''));
    expect(values).toContain('Kopi Susu');
    expect(values).toContain('Total');
  });
});
