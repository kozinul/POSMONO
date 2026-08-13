import { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { formatIDR } from '../utils/money';
import {
  sortPaymentBreakdown,
  totalOf,
  paymentMethodLabel,
} from '../utils/paymentLabels';

interface OrderItemLike {
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  subtotal?: number;
  isFreeItem?: boolean;
}

interface OrderLike {
  id: string;
  orderNumber: string;
  status?: string;
  createdAt?: string;
  items?: OrderItemLike[];
  total?: number;
  roundingAdjustment?: number;
  cashierName?: string;
  paymentBreakdown?: Array<{ method?: string; amount?: number }>;
}

interface CarriedOverBill {
  orderId: string;
  orderNumber: string;
  total: number;
  cashierName: string;
  status: string;
  createdAt: string;
}

interface ReportPrintModalProps {
  open: boolean;
  variant: 'transactions' | 'receipt';
  orders?: OrderLike[];
  paymentBreakdown?: Record<string, number>;
  totalOrders?: number;
  totalRevenue?: number;
  totalRounding?: number;
  storeName?: string;
  carriedOverBills?: CarriedOverBill[];
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  paid: { label: 'LUNAS', classes: 'bg-green-100 text-green-700' },
  completed: { label: 'SELESAI', classes: 'bg-green-100 text-green-700' },
  held: { label: 'DRAFT', classes: 'bg-yellow-100 text-yellow-700' },
  draft: { label: 'DRAFT', classes: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'DIKONFIRMASI', classes: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'DIBUAT', classes: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'BATAL', classes: 'bg-red-100 text-red-700' },
  refunded: { label: 'REFUND', classes: 'bg-red-100 text-red-700' },
  voided: { label: 'VOID', classes: 'bg-red-100 text-red-700' },
  'partially-voided': { label: 'SEBAGIAN VOID', classes: 'bg-orange-100 text-orange-700' },
};

function statusLabel(status?: string): { label: string; classes: string } {
  return STATUS_BADGE[status ?? ''] ?? { label: (status ?? '—').toUpperCase(), classes: 'bg-gray-100 text-gray-600' };
}

function itemLineTotal(item: OrderItemLike): number {
  return item.totalPrice ?? item.subtotal ?? (item.quantity ?? 0) * (item.unitPrice ?? 0);
}

function payMethodNames(breakdown: OrderLike['paymentBreakdown']): string {
  if (!breakdown || breakdown.length === 0) return '-';
  return breakdown.map((p) => paymentMethodLabel(p.method ?? '')).join(', ');
}

export function ReportPrintModal(props: ReportPrintModalProps) {
  const { open, variant, onClose } = props;
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!open) return null;

  const storeName = props.storeName ?? 'POSMono';
  const now = new Date();
  const dateLabel = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const breakdownRows = sortPaymentBreakdown(props.paymentBreakdown);
  const grandTotal = props.paymentBreakdown ? totalOf(props.paymentBreakdown) : props.totalRevenue ?? 0;
  const totalOrders = props.totalOrders ?? props.orders?.length ?? 0;

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (!printRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: `${variant === 'receipt' ? 'laporan-penerimaan' : 'laporan-transaksi'}-${now.toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(printRef.current)
        .save();
    } catch (err) {
      console.error('[Report] PDF export failed', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div
          ref={printRef}
          className={
            'receipt-print report-print bg-white font-mono text-[12px] leading-relaxed text-gray-800 overflow-y-auto ' +
            'w-[320px] max-w-[84vw]'
          }
        >
          <div className="border-b border-dashed border-gray-300 py-4 px-5 text-center">
            <p className="text-base font-bold tracking-wide">{storeName}</p>
            <p className="text-[10px] uppercase text-gray-500 mt-0.5">
              {variant === 'receipt' ? 'Laporan Penerimaan Kasir' : 'Laporan Transaksi'}
            </p>
            <p className="text-gray-500 mt-0.5">{dateLabel}</p>
            <p className="text-gray-400">{timeLabel}</p>
          </div>

          {variant === 'receipt' ? (
            <div className="px-5 py-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Transaksi</span>
                <span className="font-semibold">{totalOrders} order</span>
              </div>
              <div className="border-t border-dashed border-gray-300 my-2" />
              {breakdownRows.length === 0 ? (
                <p className="text-center text-gray-400 py-2">Belum ada penerimaan hari ini.</p>
              ) : (
                breakdownRows.map((row) => (
                  <div key={row.code} className="flex justify-between py-0.5">
                    <span>{row.label}</span>
                    <span>Rp {formatIDR(row.amount)}</span>
                  </div>
                ))
              )}
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="flex justify-between font-bold text-[13px]">
                <span>Total Penerimaan</span>
                <span>Rp {formatIDR(grandTotal)}</span>
              </div>
              {props.totalRounding != null && props.totalRounding !== 0 && (
                <div className="flex justify-between text-[10px] text-purple-700">
                  <span>Total Pembulatan</span>
                  <span>
                    {props.totalRounding > 0 ? '+' : '-'}Rp{' '}
                    {formatIDR(Math.abs(props.totalRounding))}
                  </span>
                </div>
              )}

              {(props.carriedOverBills ?? []).length > 0 && (
                <>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <p className="font-bold text-gray-700">DIBERIKAN DARI SHIFT SEBELUMNYA</p>
                  <p className="text-[10px] text-gray-500">
                    Bill aktif yang belum dibayar diteruskan ke shift ini.
                  </p>
                  {(props.carriedOverBills ?? []).map((bill) => (
                    <div key={bill.orderId} className="flex justify-between py-0.5">
                      <span className="flex flex-col items-start">
                        <span>{bill.orderNumber}</span>
                        <span className="text-[10px] text-gray-500">
                          {bill.cashierName || 'Kasir'}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">Rp {formatIDR(bill.total)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="px-5 py-3">
              {(props.orders ?? []).length === 0 ? (
                <p className="text-center text-gray-400 py-2">Belum ada transaksi hari ini.</p>
              ) : (
                (props.orders ?? []).map((order) => {
                  const badge = statusLabel(order.status ?? '');
                  return (
                    <div key={order.id} className="border-b border-dashed border-gray-300 py-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{order.orderNumber}</span>
                        <span className="text-gray-500">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                      <div className="mt-0.5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                        <span>Kasir: {order.cashierName || 'Kasir'}</span>
                        <span>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                      {(order.items ?? []).map((item, idx) => (
                        <div key={idx} className="flex justify-between py-0.5 pl-2">
                          <span className="flex-1">
                            {item.productName}
                            {item.quantity ? ` x${item.quantity}` : ''}
                            {item.isFreeItem && <span className="font-bold text-green-600"> (GRATIS)</span>}
                          </span>
                          <span className="whitespace-nowrap">
                            {item.isFreeItem ? '0' : `Rp ${formatIDR(itemLineTotal(item))}`}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-0.5">
                        <span>Total</span>
                        <span>Rp {formatIDR(order.total ?? 0)}</span>
                      </div>
                      {order.roundingAdjustment != null && order.roundingAdjustment !== 0 && (
                        <div className="flex justify-between text-[10px] text-purple-700">
                          <span>Pembulatan</span>
                          <span>
                            {order.roundingAdjustment > 0 ? '+' : '-'}Rp{' '}
                            {formatIDR(Math.abs(order.roundingAdjustment))}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Bayar</span>
                        <span>{payMethodNames(order.paymentBreakdown)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="flex justify-between font-bold">
                <span>Total Transaksi</span>
                <span>{totalOrders}</span>
              </div>
              {props.totalRounding != null && props.totalRounding !== 0 && (
                <div className="flex justify-between text-[10px] text-purple-700">
                  <span>Total Pembulatan</span>
                  <span>
                    {props.totalRounding > 0 ? '+' : '-'}Rp{' '}
                    {formatIDR(Math.abs(props.totalRounding))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 gap-2 flex bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Tutup
          </button>
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            className="flex-1 py-2 rounded-xl font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            {pdfLoading ? 'Memproses...' : 'Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 rounded-xl font-bold blue-primary text-white hover:opacity-90"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}