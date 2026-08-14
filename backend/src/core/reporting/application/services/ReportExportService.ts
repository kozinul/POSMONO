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

interface ReportTable {
  columns: ReportColumn[];
  rows: (string | number)[][];
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

  async exportSalesPerProduct(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    format: ReportExportFormat,
  ): Promise<ReportFile> {
    const rows = await this.reportService.getSalesPerProduct(tenantId, dateFrom, dateTo);

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
          ],
          rows: rows.map((r) => [
            r.productName,
            r.quantity,
            r.totalSales,
            r.dpp,
            r.serviceCharge,
            r.tax,
          ]),
          totals: [
            'Total',
            totals.quantity,
            totals.totalSales,
            totals.dpp,
            totals.serviceCharge,
            totals.tax,
          ],
        },
      ],
    };

    return this.build(doc, format, `penjualan-per-produk-${dateFrom}-${dateTo}`);
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

    for (const row of table.rows) {
      const cells = row.map((v, i) => this.formatCell(v, table.columns[i]));
      const h = this.cellHeight(pdf, cells, colW);
      ensureSpace(h);
      this.drawRow(pdf, xs, colW, cells, h, alignments);
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
    opts?: { bold?: boolean; bg?: string },
  ): void {
    const top = pdf.y;

    if (opts?.bg) {
      pdf.save();
      pdf.rect(xs[0], top, xs[xs.length - 1] - xs[0] + colW[colW.length - 1], h).fill(opts.bg);
      pdf.restore();
    }

    cells.forEach((cell, i) => {
      pdf.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#1f2937');
      pdf.text(cell, xs[i] + 4, top + 3, { width: colW[i] - 8, align: alignments[i] });
    });

    pdf.y = top + h;
    pdf.save();
    pdf.moveTo(xs[0], pdf.y - 0.5).lineTo(xs[xs.length - 1] + colW[colW.length - 1], pdf.y - 0.5)
      .lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    pdf.restore();
  }

  private cellHeight(pdf: PDFKit.PDFDocument, cells: string[], colW: number[]): number {
    pdf.font('Helvetica').fontSize(9);
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

      for (const r of table.rows) {
        const dataRow = ws.getRow(row);
        r.forEach((v, i) => {
          const cell = dataRow.getCell(i + 1);
          cell.value = v;
          this.applyCellStyle(cell, v, table.columns[i]);
        });
        row += 1;
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
