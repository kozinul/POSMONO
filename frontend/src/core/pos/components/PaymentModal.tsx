import { useState, useMemo } from 'react';
import { usePOSStore, type CartItem } from '../store/posStore';
import { api } from '../../../@shared/services/api';
import { useValidatePromoCode } from '../../../@shared/hooks/useDiscountConfiguration';

export function PaymentModal() {
  const {
    items, subtotal, serviceCharge, taxBreakdown,
    discount, discountType, discountAmount, promoCode, promoApplied,
    total, paymentState, setDiscount, setPromoCode, setPaymentState,
    setReceipt, closePaymentModal, removeItems,
    splitNumber, splitBaseOrderNumber,
  } = usePOSStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.productId))
  );
  const [amountPaid, setAmountPaid] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [promoInput, setPromoInput] = useState(promoCode);

  const validatePromo = useValidatePromoCode();

  const isSplitMode = splitNumber > 0;

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.productId)),
    [items, selectedIds],
  );

  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [selectedItems],
  );

  const selectedTotal = useMemo(() => {
    if (selectedItems.length === 0) return 0;
    if (!usePOSStore.getState().taxConfig) return selectedSubtotal;

    let discAmt = 0;
    if (discountType === 'percentage') {
      discAmt = selectedSubtotal * (Math.min(discount, 100) / 100);
    } else {
      discAmt = Math.min(discount, selectedSubtotal);
    }
    const afterDiscount = Math.max(0, selectedSubtotal - discAmt);

    if (promoApplied) {
      const ratio = selectedSubtotal / subtotal;
      const promoShare = Math.floor(promoApplied.totalDiscount * ratio);
      return Math.max(0, afterDiscount - promoShare);
    }
    return afterDiscount;
  }, [selectedItems, selectedSubtotal, discount, discountType, promoApplied, subtotal]);

  const paid = parseInt(amountPaid.replace(/\D/g, ''), 10) || 0;
  const change = paid - selectedTotal;
  const canSubmit = paid >= selectedTotal && selectedItems.length > 0 && paymentState === 'idle';

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

  const toggleItem = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.productId)));
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPaymentState('processing');
    try {
      const res = await api.post('/payments/pay-cash', {
        items: selectedItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
        amountPaid: paid,
        discount: discountType === 'percentage' ? 0 : discount,
        discountType: discount === 0 ? undefined : discountType,
        promoCode: promoCode || undefined,
      });

      const orderNumber = res.data.data.order.orderNumber;
      const nextSplitNumber = splitNumber + 1;
      const base = splitBaseOrderNumber || orderNumber;

      const hasRemaining = items.length > selectedItems.length;

      setReceipt({
        orderNumber,
        displayOrderNumber: isSplitMode || hasRemaining
          ? `${base}/${nextSplitNumber}`
          : orderNumber,
        paid,
        change,
        paidItems: selectedItems,
        hasRemaining,
      });

      removeItems(selectedItems.map((i) => i.productId));

      if (hasRemaining) {
        usePOSStore.setState({
          splitNumber: nextSplitNumber,
          splitBaseOrderNumber: base,
        });
      } else {
        usePOSStore.setState({ splitNumber: 0, splitBaseOrderNumber: null });
      }
    } catch {
      setPaymentState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-xl mx-4 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Pembayaran</h2>
            {isSplitMode && (
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                Split Bill — Bagian {splitNumber + 1}
              </p>
            )}
          </div>
          <button
            onClick={closePaymentModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Item Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-600">Pilih Item yang Dibayar</label>
              <button
                onClick={toggleAll}
                className="text-xs font-medium text-[#2176D2] hover:underline"
              >
                {selectedIds.size === items.length ? 'Batal Pilih' : 'Pilih Semua'}
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <label
                  key={item.productId}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.productId)}
                    onChange={() => toggleItem(item.productId)}
                    className="w-4 h-4 rounded border-gray-300 text-[#2176D2] focus:ring-[#2176D2]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      Rp {item.price.toLocaleString('id-ID')} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-gray-800 shrink-0">
                    Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Selected Items Total */}
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">
              {selectedItems.length} item dipilih
            </p>
            <p className="text-xl font-extrabold text-blue-700 mt-0.5">
              Rp {selectedTotal.toLocaleString('id-ID')}
            </p>
          </div>

          {/* Promo Code */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Kode Promo</label>
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
          </div>

          {/* Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Diskon Manual</label>
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

          {/* Amount Paid */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Jumlah Bayar</label>
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

          {paid >= selectedTotal && selectedItems.length > 0 && (
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
            {paymentState === 'processing'
              ? 'Memproses...'
              : isSplitMode
                ? `Bayar Bagian ${splitNumber + 1}`
                : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}
