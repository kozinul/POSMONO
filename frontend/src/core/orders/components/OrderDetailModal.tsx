import { useRef, useState } from 'react';
import { toast } from '../../../@shared/hooks/useToast';
import { formatIDR } from '../../pos/utils/money';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import { printReceipt as apiPrintReceipt } from '../../printing/hooks/usePrinters';
import { printViaClient } from '../../printing/utils/PrintClient';
import type { Order } from '../hooks/useOrders';

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

function itemLineTotal(item: Order['items'][number]): number {
  return item.totalPrice ?? item.subtotal ?? (item.quantity ?? 0) * (item.unitPrice ?? 0);
}

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [reprinting, setReprinting] = useState(false);

  const badge = statusLabel(order.status);

  const handlePrint = () => window.print();

  const handleReprint = async () => {
    if (reprinting) return;
    setReprinting(true);
    try {
      const result = await apiPrintReceipt({ orderId: order.id });
      if (result.clientPrint && result.buffer && result.printer) {
        const res = await printViaClient(result.printer, result.buffer);
        if (res.ok) {
          toast({ title: 'Struk terkirim ke printer', icon: 'success' });
          return;
        }
        if (res.error) toast({ title: res.error, icon: 'error' });
      }
      if (result.dispatched) {
        toast({ title: 'Struk terkirim ke printer', icon: 'success' });
        return;
      }
      if (result.error) toast({ title: result.error, icon: 'error' });
      handlePrint();
    } catch {
      toast({ title: 'Gagal mencetak ulang', icon: 'error' });
      handlePrint();
    } finally {
      setReprinting(false);
    }
  };

  const paid = (order.paymentBreakdown ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div
          ref={printRef}
          className="receipt-print report-print bg-white font-mono text-[12px] leading-relaxed text-gray-800 overflow-y-auto w-[360px] max-w-[90vw]"
        >
          <div className="border-b border-dashed border-gray-300 py-4 px-5 text-center">
            <p className="text-base font-bold tracking-wide">{order.orderNumber}</p>
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${badge.classes}`}>
              {badge.label}
            </span>
            <p className="text-[10px] text-gray-500 mt-1">
              Kasir: {order.cashierName || 'Kasir'}
            </p>
            <p className="text-gray-400">
              {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
              {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="px-5 py-3">
            {(order.items ?? []).map((item, idx) => {
              const isVoided = item.isVoided;
              return (
                <div key={idx} className={`py-0.5 ${isVoided ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between">
                    <span className="flex-1 pr-2">
                      {item.productName}
                      {item.quantity ? ` x${item.quantity}` : ''}
                      {isVoided && <span className="font-bold text-red-600"> (VOID)</span>}
                    </span>
                    <span className="whitespace-nowrap">
                      {isVoided ? '0' : `Rp ${formatIDR(itemLineTotal(item))}`}
                    </span>
                  </div>
                  {isVoided && item.voidedReason && (
                    <p className="text-[10px] text-red-500 pl-2">Void: {item.voidedReason}</p>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-[10px] text-gray-500 pl-2">
                      {item.modifiers.map((m) => m.name).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="space-y-0.5">
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>Subtotal</span>
                <span>Rp {formatIDR(order.subtotal ?? 0)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Diskon</span>
                  <span>- Rp {formatIDR(order.discount)}</span>
                </div>
              )}
              {order.serviceCharge !== undefined && order.serviceCharge !== 0 && (
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Service Charge</span>
                  <span>Rp {formatIDR(order.serviceCharge)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Pajak</span>
                  <span>Rp {formatIDR(order.tax)}</span>
                </div>
              )}
              {order.roundingAdjustment !== undefined && order.roundingAdjustment !== 0 && (
                <div className="flex justify-between text-[11px] text-purple-700">
                  <span>Pembulatan</span>
                  <span>
                    {order.roundingAdjustment > 0 ? '+' : '-'}Rp{' '}
                    {formatIDR(Math.abs(order.roundingAdjustment))}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[13px] pt-1 border-t border-dashed border-gray-300 mt-1">
                <span>Total</span>
                <span>Rp {formatIDR(order.roundedPayable ?? order.total ?? 0)}</span>
              </div>
              {(order.paymentBreakdown ?? []).length > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-gray-600 pt-1">
                    <span>Bayar</span>
                    <span>
                      {(order.paymentBreakdown ?? []).map((p) => paymentMethodLabel(p.method)).join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>Dibayar</span>
                    <span>Rp {formatIDR(paid)}</span>
                  </div>
                  {paid > (order.total ?? 0) && (
                    <div className="flex justify-between text-[11px] font-medium text-green-600">
                      <span>Kembalian</span>
                      <span>Rp {formatIDR(paid - (order.roundedPayable ?? order.total ?? 0))}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {(order.voidedItems ?? []).length > 0 && (
              <div className="border-t border-dashed border-gray-300 mt-2 pt-2">
                <p className="text-[10px] font-semibold text-red-600">RINCIAN VOID</p>
                {(order.voidedItems ?? []).map((v, idx) => (
                  <p key={idx} className="text-[10px] text-red-500">
                    {v.productName} x{v.quantity} - {v.voidedReason}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 gap-2 flex bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Tutup
          </button>
          <button
            onClick={handleReprint}
            disabled={reprinting}
            className="flex-1 py-2 rounded-xl font-bold border-2 border-primary-600 text-primary-600 hover:bg-primary-50 disabled:opacity-50"
          >
            {reprinting ? 'Mencetak...' : 'Print Ulang'}
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