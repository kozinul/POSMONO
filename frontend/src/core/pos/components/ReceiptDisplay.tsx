import { usePOSStore } from '../store/posStore';
import { formatIDR } from '../utils/money';

export function ReceiptDisplay() {
  const { receipt, clearCart, openPaymentModal, clearReceipt, pricing } = usePOSStore();

  if (!receipt) return null;

  const p = pricing;

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
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 text-center">
          <h2 className="text-lg font-bold text-gray-800">POSMono</h2>
          <p className="text-sm text-gray-500 mt-1">Pesanan {receipt.displayOrderNumber}</p>
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
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Original Subtotal</span>
                  <span>Rp {formatIDR(p.originalSubtotal)}</span>
                </div>
                {p.promotionDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Promotion</span>
                    <span>- Rp {formatIDR(p.promotionDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-700 font-medium">
                  <span>Net Subtotal</span>
                  <span>Rp {formatIDR(p.netSubtotal)}</span>
                </div>
                {p.serviceCharge > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{p.serviceChargeName}</span>
                    <span>Rp {formatIDR(p.serviceCharge)}</span>
                  </div>
                )}
                {p.tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{p.taxName}</span>
                    <span>Rp {formatIDR(p.tax)}</span>
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

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={() => window.print()}
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
