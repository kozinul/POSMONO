import { useState } from 'react';
import { usePOSStore } from '../store/posStore';
import { api } from '../../../@shared/services/api';
import { useValidatePromoCode } from '../../../@shared/hooks/useDiscountConfiguration';
import { useActivePaymentMethods, type PaymentMethod } from '../../payment-methods/hooks/usePaymentMethods';

const QUICK_AMOUNTS = [50000, 100000];

export function PaymentModal() {
  const {
    items, subtotal, tax, taxBreakdown, serviceCharge, total,
    paymentState, setPaymentState,
    setReceipt, closePaymentModal, removeItems,
    discount, discountType, discountAmount, promoCode, promoApplied,
    setDiscount, setPromoCode,
  } = usePOSStore();

  const { data: paymentMethods = [] } = useActivePaymentMethods();
  const validatePromo = useValidatePromoCode();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [promoInput, setPromoInput] = useState(promoCode);

  const isCash = selectedMethod?.code === 'cash';
  const paid = parseInt(amountPaid.replace(/\D/g, ''), 10) || 0;
  const change = paid - total;
  const canSubmit = selectedMethod !== null
    && (isCash ? paid >= total && total > 0 : true)
    && items.length > 0
    && paymentState === 'idle';

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

  const setQuickAmount = (amount: number) => {
    setAmountPaid(amount.toLocaleString('id-ID'));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedMethod) return;
    setPaymentState('processing');
    try {
      const res = await api.post('/payments/pay-cash', {
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
        amountPaid: isCash ? paid : total,
        method: selectedMethod.code,
        discount: discountType === 'percentage' ? 0 : discount,
        discountType: discount === 0 ? undefined : discountType,
        promoCode: promoCode || undefined,
        referenceNumber: referenceNumber || undefined,
      });

      const orderData = res.data.data.order;

      setReceipt({
        orderNumber: orderData.orderNumber,
        displayOrderNumber: orderData.orderNumber,
        paid: isCash ? paid : total,
        change: isCash ? change : 0,
        paidItems: items,
        hasRemaining: false,
      });

      removeItems(items.map((i) => i.productId));
    } catch {
      setPaymentState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="flex flex-col w-full h-full">
        {/* Header Bar */}
        <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-gray-800">Pembayaran</h2>
            <div className="blue-primary rounded-lg px-4 py-1.5 text-white">
              <span className="text-xs font-medium text-white/80">Total</span>
              <span className="text-xl font-extrabold ml-2">Rp {total.toLocaleString('id-ID')}</span>
            </div>
            <span className="text-sm text-gray-500">{items.length} item</span>
          </div>
          <button onClick={closePaymentModal} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Two Column Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Promo & Diskon */}
          <div className="flex-1 flex flex-col bg-white border-r border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Promo & Diskon</h3>

            {/* Promo Code */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Kode Promo</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="MASUKKAN KODE"
                    className="block flex-1 px-3 py-2.5 text-sm font-mono uppercase border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={paymentState === 'processing'}
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={!promoInput.trim()}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Pakai
                  </button>
                </div>
                {validatePromo.data && (
                  <p className={`mt-1.5 text-xs font-medium ${validatePromo.data.valid ? 'text-green-600' : 'text-red-500'}`}>
                    {validatePromo.data.valid ? `✓ ${validatePromo.data.ruleName}` : validatePromo.data.error}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Manual Discount */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Diskon Manual</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountInput}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    placeholder={discountType === 'percentage' ? '0' : '0'}
                    className="block flex-1 px-3 py-2.5 text-lg font-bold text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={paymentState === 'processing'}
                  />
                  <button
                    onClick={toggleDiscountType}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors min-w-[50px]"
                  >
                    {discountType === 'percentage' ? '%' : 'Rp'}
                  </button>
                </div>
              </div>

              {/* Discount Summary */}
              {(discount > 0 || (promoApplied && promoApplied.totalDiscount > 0)) && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Diskon</span>
                    <span className="text-green-700 font-bold">
                      - Rp {(discountAmount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Order Items Summary */}
            <div className="mt-auto pt-4 border-t border-gray-100">
              <div className="space-y-1.5">
                {items.slice(0, 4).map((item) => (
                  <div key={item.productId} className="flex justify-between text-xs text-gray-600">
                    <span className="truncate">{item.name} × {item.quantity}</span>
                    <span className="font-medium shrink-0 ml-2">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                  </div>
                ))}
                {items.length > 4 && <p className="text-xs text-gray-400">+{items.length - 4} item lainnya</p>}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              {tax > 0 && <div className="flex justify-between text-xs text-gray-500"><span>Pajak</span><span>Rp {tax.toLocaleString('id-ID')}</span></div>}
              {serviceCharge > 0 && <div className="flex justify-between text-xs text-gray-500"><span>SC</span><span>Rp {serviceCharge.toLocaleString('id-ID')}</span></div>}
            </div>
          </div>

          {/* Right: Payment Methods */}
          <div className="flex-1 flex flex-col bg-gray-50 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Metode Pembayaran</h3>

            {/* Method Grid */}
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => { setSelectedMethod(method); setAmountPaid(''); setReferenceNumber(''); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    selectedMethod?.id === method.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className="text-2xl shrink-0">{method.icon || '💳'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">{method.name}</p>
                  </div>
                </button>
              ))}
            </div>
            {paymentMethods.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Tidak ada metode pembayaran aktif</p>
            )}

            {/* Cash Input */}
            {isCash && selectedMethod && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Jumlah Bayar</label>
                <input
                  type="text"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Rp 0"
                  className="block w-full px-4 py-3 text-2xl font-bold text-right border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoFocus
                  disabled={paymentState === 'processing'}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setQuickAmount(total)} className="flex-1 py-2 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Uang Pas</button>
                  {QUICK_AMOUNTS.map((amt) => (
                    <button key={amt} onClick={() => setQuickAmount(amt)} disabled={amt < total} className="flex-1 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                      {amt === 50000 ? '50rb' : '100rb'}
                    </button>
                  ))}
                </div>
                {paid >= total && total > 0 && (
                  <div className="bg-green-50 rounded-xl p-3 text-center mt-3 border border-green-200">
                    <p className="text-xs text-green-700 font-medium">Kembalian</p>
                    <p className="text-xl font-extrabold text-green-600">Rp {change.toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Non-cash reference */}
            {!isCash && selectedMethod && selectedMethod.requiresReference && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nomor Referensi</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Masukkan nomor referensi"
                  className="block w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoFocus
                  disabled={paymentState === 'processing'}
                />
              </div>
            )}

            {paymentState === 'error' && (
              <div className="mt-4 bg-red-50 rounded-xl p-3 text-center border border-red-200">
                <p className="text-sm text-red-600 font-medium">Pembayaran gagal.</p>
              </div>
            )}

            {/* Pay Button */}
            <div className="mt-auto pt-4">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-4 rounded-xl font-bold text-white uppercase tracking-wide text-lg transition-all ${
                  canSubmit ? 'blue-primary hover:opacity-90' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {paymentState === 'processing' ? 'Memproses...' : `Bayar Rp ${total.toLocaleString('id-ID')}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
