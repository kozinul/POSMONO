import { usePOSStore } from '../store/posStore';
import { formatIDR } from '../utils/money';
import { renderLayoutToHtml } from '../../templates/utils/renderLayoutToHtml';
import type { PricingResult } from '../../../@shared/hooks/usePricing';
import { useQueryClient } from '@tanstack/react-query';
import { reprintReceipt } from '../../printing/utils/autoPrint';

function getChargeRate(adjustments: PricingResult['adjustments']): number {
  const charge = adjustments.find((a) => a.type === 'CHARGE');
  return charge?.rate ?? 0;
}

function getTaxRate(adjustments: PricingResult['adjustments']): number {
  const tax = adjustments.find((a) => a.type === 'TAX');
  return tax?.rate ?? 0;
}

function downloadBase64(base64: string, filename: string, mime: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReceiptDisplay() {
  const { receipt, clearCart, openPaymentModal, clearReceipt, pricing } = usePOSStore();
  const queryClient = useQueryClient();

  if (!receipt) return null;

  const p = receipt.pricing ?? pricing;
  const isInclusive = receipt.paidItems.some((i) => i.pricingMode === 'inclusive');

  const scRate = p ? getChargeRate(p.adjustments) : 0;
  const txRate = p ? getTaxRate(p.adjustments) : 0;

  const layoutHtml = receipt.layout ? renderLayoutToHtml(receipt.layout) : null;

  const handleNewOrder = () => {
    if (receipt.hasRemaining) {
      clearReceipt();
      openPaymentModal();
    } else {
      clearCart();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl receipt-print">
        {layoutHtml ? (
          <div className="p-6 border-b border-gray-100">
            <div
              className="font-mono text-xs text-gray-800"
              dangerouslySetInnerHTML={{ __html: layoutHtml }}
            />
            {receipt.templateName && (
              <p className="text-[10px] text-gray-400 text-center mt-3">
                Template: {receipt.templateName}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-100 text-center">
              <h2 className="text-lg font-bold text-gray-800">POSMono</h2>
              <p className="text-sm text-gray-500 mt-1">Pesanan {receipt.displayOrderNumber}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Kasir: {receipt.cashierName || 'Kasir'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(receipt.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {receipt.hasRemaining && (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  Item tersisa di keranjang
                </p>
              )}
            </div>

            <div className="p-6 space-y-3">
              {(receipt.paidItems || []).map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name} x{item.quantity}
                    {item.isFreeItem && <span className="ml-1 text-green-600 font-bold">(GRATIS)</span>}
                  </span>
                  <span className="font-medium text-gray-800">
                    {item.isFreeItem ? 'GRATIS' : `Rp ${formatIDR(item.price * item.quantity)}`}
                  </span>
                </div>
              ))}

              <div className="border-t pt-3 space-y-1">
                {p ? (
                  <>
                    {p.promotionDiscount > 0 && (
                      <div className="bg-green-50 rounded-lg p-2 border border-green-200 space-y-0.5 mb-2">
                        {p.appliedRules.map((r) => (
                          <div key={r.ruleId} className="flex justify-between text-xs">
                            <span className="text-green-700">{r.ruleName}</span>
                            <span className="text-green-700 font-medium">{r.description}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs pt-0.5 border-t border-green-200 font-medium">
                          <span className="text-green-700">Total Diskon</span>
                          <span className="text-green-700">- Rp {formatIDR(p.promotionDiscount)}</span>
                        </div>
                      </div>
                    )}

                    {isInclusive && (scRate > 0 || txRate > 0) && (
                      <p className="text-[11px] text-gray-400 text-center -mb-1">
                        Harga sudah termasuk pajak &amp; service ({txRate > 0 ? `${txRate}%` : ''}{txRate > 0 && scRate > 0 ? ' + ' : ''}{scRate > 0 ? `${scRate}%` : ''}{txRate > 0 || scRate > 0 ? ` = ${txRate + scRate}%` : ''})
                      </p>
                    )}

                    <div className="flex justify-between text-sm text-gray-700 font-medium">
                      <span>Subtotal</span>
                      <span>Rp {formatIDR(p.originalSubtotal - p.promotionDiscount)}</span>
                    </div>
                    {p.serviceCharge > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>{p.serviceChargeName}{scRate > 0 ? ` (${scRate}%)` : ''}</span>
                        <span>Rp {formatIDR(p.serviceCharge)}</span>
                      </div>
                    )}
                    {p.tax > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>{p.taxName}{txRate > 0 ? ` (${txRate}%)` : ''}</span>
                        <span>Rp {formatIDR(p.tax)}</span>
                      </div>
                    )}
                    {p.rounding !== 0 && (
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Pembulatan</span>
                        <span>{p.rounding > 0 ? '+' : ''}Rp {formatIDR(p.rounding)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>Rp {formatIDR(receipt.grandTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
                  <span>Total</span>
                  <span>Rp {formatIDR(receipt.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 pt-1">
                  <span>Tunai</span>
                  <span>Rp {formatIDR(receipt.paid)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-green-600">
                  <span>Kembalian</span>
                  <span>Rp {formatIDR(receipt.change)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="p-6 pt-0 flex gap-3 receipt-actions">
          {receipt.pdf && (
            <button
              onClick={() => downloadBase64(receipt.pdf!, `${receipt.displayOrderNumber}.pdf`, 'application/pdf')}
              className="flex-1 py-3 rounded-xl font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              PDF
            </button>
          )}
          <button
            onClick={async () => {
              const mode = await reprintReceipt(queryClient, receipt.thermal);
              if (mode === 'browser') window.print();
            }}
            className="flex-1 py-3 rounded-xl font-bold border-2 border-primary-600 text-primary-600 hover:bg-primary-50 transition-colors"
          >
            Print
          </button>
          <button
            onClick={handleNewOrder}
            className="flex-[2] blue-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            {receipt.hasRemaining ? 'Bayar Sisanya' : 'Selesai'}
          </button>
        </div>
      </div>
    </div>
  );
}
