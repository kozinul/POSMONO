import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePOSStore, type CartItem } from '../store/posStore';
import { api } from '../../../@shared/services/api';
import { useValidatePromoCode } from '../../../@shared/hooks/useDiscountConfiguration';
import { useCalculatePricing } from '../../../@shared/hooks/usePricing';
import { useActivePaymentMethods, type PaymentMethod } from '../../payment-methods/hooks/usePaymentMethods';
import { formatIDR } from '../utils/money';

const QUICK_AMOUNTS = [50000, 100000];

export function PaymentModal() {
  const {
    items, pricing, paymentState, setPaymentState,
    setReceipt, closePaymentModal, removeItems, updateQuantity,
    promoCode, manualDiscount, manualDiscountType,
    setManualDiscount, setPromoCode, closeBillAfterPayment,
    activeBillId, activeBillNumber, saveBill,
    splitNumber, splitBaseOrderNumber, registerSplitPayment,
  } = usePOSStore();

  const { data: paymentMethods = [] } = useActivePaymentMethods();
  const validatePromo = useValidatePromoCode();
  const portionPricing = useCalculatePricing();
  const queryClient = useQueryClient();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [promoInput, setPromoInput] = useState(promoCode);
  const [paymentMessage, setPaymentMessage] = useState('');

  const [splitMode, setSplitMode] = useState(false);
  const [payQuantities, setPayQuantities] = useState<Record<string, number>>({});

  const isCash = selectedMethod?.code === 'cash';
  const paid = parseInt(amountPaid.replace(/\D/g, ''), 10) || 0;

  const payQty = (productId: string) => payQuantities[productId] ?? 0;

  const setQty = (productId: string, qty: number) => {
    setPayQuantities((prev) => {
      const item = items.find((i) => i.productId === productId);
      if (!item) return prev;
      const clamped = Math.max(0, Math.min(qty, item.quantity));
      return { ...prev, [productId]: clamped };
    });
  };

  const toggleItem = (productId: string) => {
    const item = items.find((i) => i.productId === productId);
    if (!item) return;
    setQty(productId, payQty(productId) > 0 ? 0 : item.quantity);
  };

  const selectAll = () => {
    const allSelected = items.every((i) => i.isFreeItem || payQty(i.productId) === i.quantity);
    setPayQuantities((prev) => {
      if (allSelected) return {};
      const next: Record<string, number> = {};
      for (const item of items) {
        if (item.isFreeItem) {
          next[item.productId] = item.quantity;
        } else {
          next[item.productId] = item.quantity;
        }
      }
      return { ...prev, ...next };
    });
  };

  const selectedItems = useMemo(
    () => items.filter((i) => i.isFreeItem || payQty(i.productId) > 0),
    [items, payQuantities],
  );

  const selectedTotal = useMemo(
    () => items.reduce((sum, i) => {
      const qty = i.isFreeItem ? i.quantity : payQty(i.productId);
      return sum + (i.isFreeItem ? 0 : i.price * qty);
    }, 0),
    [items, payQuantities],
  );

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const selectedUnits = items.reduce((sum, i) => sum + (i.isFreeItem ? i.quantity : payQty(i.productId)), 0);

  useEffect(() => {
    if (!splitMode) {
      portionPricing.reset();
      return;
    }
    const paid = items.filter((i) => !i.isFreeItem && payQty(i.productId) > 0);
    if (paid.length === 0) {
      portionPricing.reset();
      return;
    }
    portionPricing.mutate({
      items: paid.map((i) => ({
        productId: i.productId,
        productName: i.name,
        categoryId: i.categoryId || '',
        quantity: payQty(i.productId),
        unitPrice: i.price,
        pricingMode: i.pricingMode,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMode, items, payQuantities]);

  const portionTotal = splitMode && portionPricing.data ? portionPricing.data.grandTotal : selectedTotal;
  const portionPending = splitMode && selectedTotal > 0 && portionPricing.isPending;

  const rawTotal = splitMode ? portionTotal : (pricing?.grandTotal ?? 0);
  const roundedPayable = splitMode
    ? (portionPricing.data?.roundedPayable ?? portionTotal)
    : (pricing?.roundedPayable ?? pricing?.grandTotal ?? 0);
  const payable = isCash ? roundedPayable : rawTotal;
  const rounding = isCash ? roundedPayable - rawTotal : 0;
  const change = paid - payable;

  const canSubmit = selectedMethod !== null
    && (isCash ? paid >= payable && payable > 0 : true)
    && (splitMode ? selectedTotal > 0 && !portionPending : items.length > 0)
    && paymentState !== 'processing';

  const handleDiscountChange = (value: string) => {
    setDiscountInput(value);
    const numeric = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setManualDiscount(numeric, manualDiscountType);
  };

  const toggleDiscountType = () => {
    const newType = manualDiscountType === 'percentage' ? 'nominal' : 'percentage';
    const numeric = parseInt(discountInput.replace(/\D/g, ''), 10) || 0;
    setManualDiscount(numeric, newType);
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
    setPaymentMessage('');

    try {
      const portionIndex = splitNumber + 1;
      const isSplitPortion = splitMode || !!splitBaseOrderNumber;
      const splitBase = splitBaseOrderNumber ?? (splitMode && activeBillId ? activeBillNumber : undefined);

      const payload: Record<string, unknown> = {
        items: (splitMode ? selectedItems : items).map((i) => ({
          productId: i.productId,
          productName: i.name,
          categoryId: i.categoryId || '',
          quantity: splitMode
            ? (i.isFreeItem ? i.quantity : payQty(i.productId))
            : i.quantity,
          unitPrice: i.price,
          pricingMode: i.pricingMode || undefined,
          isFreeItem: i.isFreeItem || undefined,
        })),
        amountPaid: isCash ? paid : rawTotal,
        method: selectedMethod.code,
        referenceNumber: referenceNumber || undefined,
        ...(isSplitPortion ? { splitIndex: portionIndex } : {}),
        ...(splitBase ? { splitBaseOrderNumber: splitBase } : {}),
        ...(usePOSStore.getState().openShiftId ? { shiftId: usePOSStore.getState().openShiftId } : {}),
      };
      if (!splitMode) {
        payload.discount = manualDiscount;
        payload.discountType = manualDiscountType;
        payload.promoCode = promoCode || undefined;
      }

      const res = await api.post('/payments/pay-cash', payload);

      const orderData = res.data.data.order;
      const receiptData = res.data.data.receipt;

      const hasRemaining = splitMode
        ? items.some((i) => !i.isFreeItem && payQty(i.productId) < i.quantity)
        : false;

      if (isSplitPortion) {
        registerSplitPayment(splitBase ?? orderData.orderNumber);
      }

      if (splitMode) {
        for (const item of items) {
          const qty = item.isFreeItem ? item.quantity : payQty(item.productId);
          if (qty <= 0) continue;
          if (qty >= item.quantity) {
            removeItems([item.productId]);
          } else {
            updateQuantity(item.productId, -qty);
          }
        }
      } else {
        removeItems(items.map((i) => i.productId));
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['open-shift'] });
      queryClient.invalidateQueries({ queryKey: ['shift-report'] });

      const displayOrderNumber = isSplitPortion
        ? `${splitBase ?? orderData.orderNumber}/${portionIndex}`
        : orderData.orderNumber;

      setReceipt({
        orderNumber: isSplitPortion ? (splitBase ?? orderData.orderNumber) : orderData.orderNumber,
        displayOrderNumber,
        paid: isCash ? paid : rawTotal,
        change: isCash ? change : 0,
        grandTotal: payable,
        paidItems: splitMode ? selectedItems : items,
        hasRemaining,
        createdAt: orderData.createdAt,
        cashierName: orderData.cashierName || '',
        layout: receiptData?.layout ?? null,
        thermal: receiptData?.thermal ?? null,
        pdf: receiptData?.pdf ?? null,
        templateName: receiptData?.templateName ?? null,
        pricing: splitMode ? (portionPricing.data ?? null) : (pricing ?? null),
      });
      usePOSStore.getState().registerShiftPayment({ total: payable, method: selectedMethod.code, isCash });

      if (hasRemaining) {
        if (activeBillId) {
          await saveBill();
        }
      } else {
        closeBillAfterPayment();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Pembayaran gagal.';
      setPaymentState('error');
      setPaymentMessage(msg);
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
              <span className="text-xl font-extrabold ml-2">Rp {formatIDR(rawTotal)}</span>
            </div>
            <span className="text-sm text-gray-500">
              {splitMode ? `${selectedUnits}/${totalUnits} unit` : `${items.length} item`}
            </span>
          </div>
          <button onClick={closePaymentModal} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Two Column Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Items + Promo */}
          <div className="flex-1 flex flex-col bg-white border-r border-gray-200 p-5">
            {/* Split Bill Toggle */}
            {totalUnits > 1 && (
              <div className="flex items-center justify-between mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <p className="text-sm font-bold text-amber-800">Split Bill</p>
                  <p className="text-xs text-amber-600">Pilih item yang mau dibayar</p>
                </div>
                <button
                  onClick={() => {
                    setSplitMode(!splitMode);
                    setPayQuantities({});
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    splitMode ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    splitMode ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
            )}

            {/* Item List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 mb-4">
              {splitMode && (
                <button
                  onClick={selectAll}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  {items.every((i) => i.isFreeItem || payQty(i.productId) === i.quantity) ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              )}
              {items.map((item) => {
                const qty = payQty(item.productId);
                const isSelected = item.isFreeItem || qty > 0;
                const rowTotal = item.isFreeItem ? 0 : item.price * qty;
                return (
                  <div
                    key={item.productId}
                    onClick={() => splitMode && !item.isFreeItem && toggleItem(item.productId)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      splitMode && !item.isFreeItem ? 'cursor-pointer' : ''
                    } ${
                      splitMode && isSelected
                        ? 'bg-blue-50 border border-blue-300'
                        : splitMode
                          ? 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                          : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {splitMode && (
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          item.isFreeItem
                            ? 'bg-green-500 border-green-500'
                            : isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {(isSelected || item.isFreeItem) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      )}
                      <span className="truncate">
                        {item.name}
                        {item.isFreeItem && <span className="ml-1 text-green-600 font-bold">(GRATIS)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      {splitMode && !item.isFreeItem && item.quantity > 1 && (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setQty(item.productId, qty - 1)}
                            disabled={qty === 0}
                            className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className={`text-sm font-bold w-5 text-center ${qty > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {qty}
                          </span>
                          <button
                            onClick={() => setQty(item.productId, qty + 1)}
                            disabled={qty === item.quantity}
                            className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <span className="font-medium w-24 text-right">
                        {item.isFreeItem ? 'GRATIS' : qty > 0 ? `Rp ${formatIDR(rowTotal)}` : `Rp ${formatIDR(item.price * item.quantity)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Promo & Diskon — only in full payment mode */}
            {!splitMode && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-700">Promo & Diskon</h3>
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
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Diskon Manual</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      placeholder="0"
                      className="block flex-1 px-3 py-2.5 text-lg font-bold text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={paymentState === 'processing'}
                    />
                    <button
                      onClick={toggleDiscountType}
                      className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors min-w-[50px]"
                    >
                      {manualDiscountType === 'percentage' ? '%' : 'Rp'}
                    </button>
                  </div>
                </div>
                {pricing && (pricing.promotionDiscount > 0 || pricing.appliedRules.length > 0) && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-1">
                    {pricing.appliedRules.map((r) => (
                      <div key={r.ruleId} className="flex justify-between text-xs">
                        <span className="text-green-700">{r.ruleName}</span>
                        <span className="text-green-700 font-medium">{r.description}</span>
                      </div>
                    ))}
                    {pricing.promotionDiscount > 0 && (
                      <div className="flex justify-between text-sm pt-1 border-t border-green-200">
                        <span className="text-green-700 font-medium">Total Diskon</span>
                        <span className="text-green-700 font-bold">- Rp {formatIDR(pricing.promotionDiscount)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Payment Methods */}
          <div className="flex-1 flex flex-col bg-gray-50 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Metode Pembayaran</h3>

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

            {isCash && selectedMethod && (
              <div className="mt-4">
                {rounding !== 0 && (
                  <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2 mb-3 border border-purple-200">
                    <span className="text-xs font-medium text-purple-700">Pembulatan</span>
                    <span className={`text-sm font-bold ${rounding > 0 ? 'text-purple-700' : 'text-green-700'}`}>
                      {rounding > 0 ? '+' : '-'}Rp {formatIDR(Math.abs(rounding))}
                    </span>
                  </div>
                )}
                {rounding !== 0 && (
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2 mb-3 border border-blue-200">
                    <span className="text-xs font-medium text-blue-700">Total Tagihan (dibulatkan)</span>
                    <span className="text-sm font-bold text-blue-800">Rp {formatIDR(payable)}</span>
                  </div>
                )}
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
                  <button onClick={() => setQuickAmount(payable)} className="flex-1 py-2 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Uang Pas</button>
                  {QUICK_AMOUNTS.map((amt) => (
                    <button key={amt} onClick={() => setQuickAmount(amt)} disabled={amt < payable} className="flex-1 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                      {amt === 50000 ? '50rb' : '100rb'}
                    </button>
                  ))}
                </div>
                {paid >= payable && payable > 0 && (
                  <div className="bg-green-50 rounded-xl p-3 text-center mt-3 border border-green-200">
                    <p className="text-xs text-green-700 font-medium">Kembalian</p>
                    <p className="text-xl font-extrabold text-green-600">Rp {formatIDR(change)}</p>
                  </div>
                )}
              </div>
            )}

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
                <p className="text-sm text-red-600 font-medium">{paymentMessage || 'Pembayaran gagal.'}</p>
              </div>
            )}

            <div className="mt-auto pt-4">
              {splitMode && (
                <p className="text-xs text-amber-600 font-medium text-center mb-2">
                  Bayar {selectedUnits} dari {totalUnits} unit · Rp {formatIDR(rawTotal)}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-4 rounded-xl font-bold text-white uppercase tracking-wide text-lg transition-all ${
                  canSubmit ? 'blue-primary hover:opacity-90' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {paymentState === 'processing'
                  ? 'Memproses...'
                  : portionPending
                    ? 'Menghitung...'
                    : `Bayar Rp ${formatIDR(payable)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
