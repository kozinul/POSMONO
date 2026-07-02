import { useState } from 'react';
import { usePOSStore } from '../store/posStore';
import { api } from '../../../@shared/services/api';
import { useValidatePromoCode } from '../../../@shared/hooks/useDiscountConfiguration';

export function PaymentModal() {
  const { items, subtotal, serviceCharge, serviceChargeName, taxBreakdown, discount, discountType, discountAmount, promoCode, promoApplied, total, paymentState, setDiscount, setPromoCode, setPaymentState, setReceipt, closePaymentModal } =
    usePOSStore();
  const [amountPaid, setAmountPaid] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [promoInput, setPromoInput] = useState(promoCode);
  const validatePromo = useValidatePromoCode();
  const paid = parseInt(amountPaid.replace(/\D/g, ''), 10) || 0;
  const change = paid - total;
  const canSubmit = paid >= total && paymentState === 'idle';

  const handleDiscountChange = (value: string) => {
    setDiscountInput(value);
    const numeric = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setDiscount(numeric, discountType);
  };

  const toggleDiscountType = () => {
    const newType = discountType === 'percentage' ? 'nominal' : 'percentage';
    const numeric = parseInt(discountInput.replace(/\D/g, ''), 10) || 0;
    setDiscount(numeric, newType);
  };

  const handleApplyPromo = () => {
    setPromoCode(promoInput);
    validatePromo.mutate(promoInput);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPaymentState('processing');
    try {
      const res = await api.post('/payments/pay-cash', {
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
        amountPaid: paid,
        discount,
        discountType,
        promoCode,
      });
      setReceipt({
        orderNumber: res.data.data.order.orderNumber,
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

        <div className="p-6 space-y-4">
          {/* Price Breakdown */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{serviceChargeName} ({Math.round((serviceCharge / subtotal) * 100)}%)</span>
                <span>Rp {serviceCharge.toLocaleString('id-ID')}</span>
              </div>
            )}
            {taxBreakdown.map((t) => (
              <div key={t.ruleId} className="flex justify-between text-gray-600">
                <span>{t.name}</span>
                <span>Rp {t.amount.toLocaleString('id-ID')}</span>
              </div>
            ))}
            {promoApplied && promoApplied.appliedRules.map((r) => (
              <div key={r.ruleId} className="flex justify-between text-green-600 text-sm">
                <span>{r.ruleName}</span>
                <span>- Rp {r.discountAmount.toLocaleString('id-ID')}</span>
              </div>
            ))}
            {discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Diskon Manual {discountType === 'percentage' ? `(${discount}%)` : ''}</span>
                <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-900 font-bold text-lg pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Promo Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Kode Promo
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="CONTOH10"
                className="block flex-1 px-4 py-2 text-sm font-mono uppercase border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={paymentState === 'processing'}
              />
              <button
                onClick={handleApplyPromo}
                disabled={!promoInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Pakai
              </button>
            </div>
            {validatePromo.data && (
              <p className={`mt-1 text-xs ${validatePromo.data.valid ? 'text-green-600' : 'text-red-500'}`}>
                {validatePromo.data.valid ? `✓ ${validatePromo.data.ruleName}` : validatePromo.data.error}
              </p>
            )}
            {validatePromo.isError && (
              <p className="mt-1 text-xs text-red-500">Gagal validasi kode promo</p>
            )}
          </div>

          {/* Discount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Diskon Manual
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={discountInput}
                onChange={(e) => handleDiscountChange(e.target.value)}
                placeholder={discountType === 'percentage' ? '0%' : 'Rp 0'}
                className="block flex-1 px-4 py-2 text-lg font-bold text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={paymentState === 'processing'}
              />
              <button
                onClick={toggleDiscountType}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {discountType === 'percentage' ? '%' : 'Rp'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Jumlah Bayar
            </label>
            <input
              type="text"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="Rp 0"
              className="block w-full px-4 py-3 text-2xl font-bold text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
              disabled={paymentState === 'processing'}
            />
          </div>

          {paid >= total && (
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-700 font-medium">Kembalian</p>
              <p className="text-2xl font-extrabold text-green-600 mt-1">
                Rp {change.toLocaleString('id-ID')}
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
