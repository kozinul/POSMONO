import { usePOSStore } from '../store/posStore';

export function ReceiptDisplay() {
  const { receipt, items, total, tax, subtotal, clearCart } = usePOSStore();

  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 text-center">
          <h2 className="text-lg font-bold text-gray-800">POSMono</h2>
          <p className="text-sm text-gray-500 mt-1">Pesanan {receipt.orderNumber}</p>
        </div>

        <div className="p-6 space-y-3">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.name} x{item.quantity}
              </span>
              <span className="font-medium text-gray-800">
                Rp {(item.price * item.quantity).toLocaleString('id-ID')}
              </span>
            </div>
          ))}

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Pajak (10%)</span>
              <span>Rp {tax.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
              <span>Total</span>
              <span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pt-1">
              <span>Tunai</span>
              <span>Rp {receipt.paid.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-green-600">
              <span>Kembalian</span>
              <span>Rp {receipt.change.toLocaleString('id-ID')}</span>
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
            onClick={clearCart}
            className="flex-[2] blue-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            New Order
          </button>
        </div>
      </div>
    </div>
  );
}
