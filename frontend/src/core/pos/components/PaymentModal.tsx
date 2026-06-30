import { useState } from 'react';
import { usePOSStore } from '../store/posStore';
import { api } from '../../../@shared/services/api';

export function PaymentModal() {
  const { items, total, paymentState, setPaymentState, setReceipt, closePaymentModal, clearCart } =
    usePOSStore();
  const [amountPaid, setAmountPaid] = useState('');
  const paid = parseInt(amountPaid.replace(/\D/g, ''), 10) || 0;
  const change = paid - total;
  const canSubmit = paid >= total && paymentState === 'idle';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPaymentState('processing');
    try {
      const res = await api.post('/api/payments/pay-cash', {
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
        amountPaid: paid,
        change,
      });
      setReceipt({
        orderNumber: res.data.data.orderNumber,
        paid,
        change,
      });
    } catch {
      setPaymentState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Pembayaran Tunai</h2>
          <button
            onClick={closePaymentModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Total Belanja</p>
            <p className="text-4xl font-extrabold text-gray-900">
              Rp. {total.toLocaleString('id-ID')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Jumlah Bayar
            </label>
            <input
              type="text"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="Rp. 0"
              className="block w-full px-4 py-3 text-2xl font-bold text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
              disabled={paymentState === 'processing'}
            />
          </div>

          {paid >= total && (
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-700 font-medium">Kembalian</p>
              <p className="text-2xl font-extrabold text-green-600 mt-1">
                Rp. {change.toLocaleString('id-ID')}
              </p>
            </div>
          )}

          {paymentState === 'error' && (
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-red-600 font-medium">
                Pembayaran gagal. Silakan coba lagi.
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all uppercase tracking-wide ${
              canSubmit
                ? 'blue-primary hover:opacity-90'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {paymentState === 'processing' ? 'Memproses...' : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}
