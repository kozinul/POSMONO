import { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { formatIDR } from '../../pos/utils/money';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import { type RefundRow, refundReference } from '../../payments/hooks/useRefund';

interface RefundReceiptModalProps {
  open: boolean;
  refund: RefundRow | null;
  storeName?: string;
  onClose: () => void;
}

export function RefundReceiptModal({ open, refund, storeName, onClose }: RefundReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!open || !refund) return null;

  const name = storeName ?? 'POSMono';
  const now = new Date(refund.refundedAt);

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (!printRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: `struk-refund-${refund.orderNumber}-${now.toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(printRef.current)
        .save();
    } catch (err) {
      console.error('[Refund] PDF export failed', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div
          ref={printRef}
          className="receipt-print report-print bg-white font-mono text-[12px] leading-relaxed text-gray-800 overflow-y-auto w-[320px] max-w-[84vw]"
        >
          <div className="border-b border-dashed border-gray-300 py-4 px-5 text-center">
            <p className="text-base font-bold tracking-wide">{name}</p>
            <p className="text-[10px] uppercase text-gray-500 mt-0.5">Struk Refund</p>
            <p className="text-gray-500 mt-0.5">
              {now.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="text-gray-400">
              {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="px-5 py-3">
            <div className="flex justify-between">
              <span className="text-gray-500">No. Order</span>
              <span className="font-semibold">{refund.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Kasir</span>
              <span>{refund.cashierName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pembayaran</span>
              <span>{paymentMethodLabel(refund.method)}</span>
            </div>
            {refund.method !== 'cash' && (
              <div className="flex justify-between">
                <span className="text-gray-500">Kode Ref</span>
                <span>{refundReference(refund)}</span>
              </div>
            )}

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Alasan</span>
            </div>
            <p className="text-[11px]">{refund.reason || '-'}</p>

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="flex justify-between font-bold text-[13px] text-red-700">
              <span>REFUND</span>
              <span>Rp {formatIDR(refund.amount)}</span>
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="flex justify-between text-[10px] text-gray-500">
              <span>No. Refund</span>
              <span>{refund.refundId}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Refunded By</span>
              <span>{refund.refundedByName || '-'}</span>
            </div>
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
            onClick={handlePdf}
            disabled={pdfLoading}
            className="flex-1 py-2 rounded-xl font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            {pdfLoading ? 'Memproses...' : 'Arsip PDF'}
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
