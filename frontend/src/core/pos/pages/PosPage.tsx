import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePOSStore } from '../store/posStore';
import { useProducts, useCategories, useBarcodeLookup } from '../hooks/useProducts';
import { useFamilies } from '../hooks/useFamilies';
import { useDiscountConfiguration } from '../../../@shared/hooks/useDiscountConfiguration';
import {
  getActiveProductDiscounts,
  getProductDiscount,
} from '../../../@shared/utils/discountCalculator';
import { ProductCard } from '../components/ProductCard';
import { CartItemRow } from '../components/CartItemRow';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptDisplay } from '../components/ReceiptDisplay';
import { toast } from '../../../@shared/hooks/useToast';
import { formatIDR } from '../utils/money';
import { useHeldOrders } from '../hooks/useHeldOrders';
import { useStockList } from '../../inventory/hooks/useInventory';
import { useOpenShift } from '../../shifts/hooks/useShift';
import { PosVoidModal } from '../components/PosVoidModal';
import { PosActionPanel } from '../components/PosActionPanel';
import { useAuthStore, hasPermission } from '../../../@shared/hooks/useAuth';
import { VOID_ORDER_PERMISSION } from '../../../@shared/utils/permissions';
import { useVoidOrder, useVoidItem } from '../../orders/hooks/useOrders';
import type { CartItem } from '../store/posStore';

export default function PosPage() {
  const {
    items,
    pricing,
    pricingLoading,
    promoCode,
    manualDiscount,
    manualDiscountType,
    paymentModalOpen,
    receipt,
    customerName,
    tableNumber,
    addItem,
    setProductPrices,
    setDiscountRules,
    setPromoCode,
    setManualDiscount,
    setCustomerName,
    setTableNumber,
    openPaymentModal,
    recalculate,
    openBill,
    saveBill,
    discardBill,
    activeBillId,
    activeBillNumber,
    heldOrders,
    mergeHeldOrders,
    refreshItemPrices,
    seedOpenShift,
    voidItemOnBill,
  } = usePOSStore();

  const currentUser = useAuthStore((s) => s.user);
  const canVoidSelf = hasPermission(currentUser, VOID_ORDER_PERMISSION);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);

  const { data: discountConfig } = useDiscountConfiguration();
  const { data: openShift } = useOpenShift();

  useEffect(() => {
    seedOpenShift(openShift ?? null);
  }, [openShift, seedOpenShift]);

  useEffect(() => {
    if (discountConfig?.rules) {
      setDiscountRules(discountConfig.rules);
    }
  }, [discountConfig, setDiscountRules]);

  const [holdError, setHoldError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ item: CartItem; itemIndex: number } | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidPending, setVoidPending] = useState(false);
  const [viewTransaction, setViewTransaction] = useState<any>(null);
  const [voidOrderTarget, setVoidOrderTarget] = useState<{
    id: string;
    orderNumber: string;
    itemIndex?: number;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>();

  const { lookupBarcode } = useBarcodeLookup();
  const { data: stocks = [] } = useStockList();
  const { data: heldOrdersQuery } = useHeldOrders();

  useEffect(() => {
    if (heldOrdersQuery) {
      mergeHeldOrders(heldOrdersQuery);
    }
  }, [heldOrdersQuery, mergeHeldOrders]);

  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stocks) m[s.productId] = s.availableQuantity;
    return m;
  }, [stocks]);

  const cartQtyByProduct = useMemo(() => {
    const m: Record<string, number> = {};
    for (const item of items) {
      if (item.isFreeItem) continue;
      m[item.productId] = (m[item.productId] ?? 0) + item.quantity;
    }
    return m;
  }, [items]);

  const getAvailableStock = useCallback(
    (productId: string) => {
      const available = stockMap[productId] ?? 0;
      return available > 0 ? available : undefined;
    },
    [stockMap],
  );

  const handleBarcodeInput = useCallback(
    async (barcode: string) => {
      const product = await lookupBarcode(barcode, getAvailableStock);
      if (product) {
        searchRef.current?.blur();
      }
    },
    [lookupBarcode, getAvailableStock],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (document.activeElement === searchRef.current) return;

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3) {
        const code = barcodeBuffer.current;
        barcodeBuffer.current = '';
        handleBarcodeInput(code);
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => {
          barcodeBuffer.current = '';
        }, 100);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBarcodeInput]);

  const {
    data: products = [],
    isLoading,
    isError,
  } = useProducts(search || undefined, selectedCategory ?? undefined);
  const { data: categories = [], isError: categoriesError } = useCategories();
  const { data: families = [] } = useFamilies();

  useEffect(() => {
    if (products.length > 0) {
      const prices: Record<string, number> = {};
      for (const p of products) {
        prices[p.id] = p.basePrice;
      }
      setProductPrices(prices);
      if (refreshItemPrices(prices)) {
        recalculate();
      }
    }
  }, [products, setProductPrices, refreshItemPrices, recalculate]);

  useEffect(() => {
    recalculate();
  }, [promoCode, manualDiscount, manualDiscountType, recalculate]);

  const activeProductDiscounts = useMemo(() => {
    if (!discountConfig?.rules) return new Map();
    return getActiveProductDiscounts(discountConfig.rules);
  }, [discountConfig]);

  const filteredCategories = selectedFamily
    ? categories.filter((c) => c.familyId === selectedFamily)
    : categories;

  const p = pricing;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const paidItemIndex = useMemo(() => {
    const m: Record<string, number> = {};
    let i = 0;
    for (const item of items) {
      if (item.isFreeItem) continue;
      m[item.productId] = i++;
    }
    return m;
  }, [items]);

  const handleVoidItem = (item: CartItem) => {
    const index = paidItemIndex[item.productId];
    if (index === undefined) return;
    setVoidError(null);
    setVoidTarget({ item, itemIndex: index });
  };

  const submitVoidItem = async (reason: string, managerPin?: string) => {
    if (!voidTarget) return;
    setVoidPending(true);
    setVoidError(null);
    const res = await voidItemOnBill({
      productId: voidTarget.item.productId,
      itemIndex: voidTarget.itemIndex,
      reason,
      managerPin,
    });
    setVoidPending(false);
    if (res.ok) {
      setVoidTarget(null);
    } else {
      setVoidError(res.error ?? 'Gagal memvoid item');
    }
  };

  const voidOrderMutate = useVoidOrder();
  const voidItemMutate = useVoidItem();

  const submitVoidOrder = async (reason: string, managerPin?: string) => {
    if (!voidOrderTarget) return;
    setVoidPending(true);
    setVoidError(null);
    const userName = currentUser?.displayName || 'Kasir';
    try {
      if (voidOrderTarget.itemIndex !== undefined) {
        await voidItemMutate.mutateAsync({
          orderId: voidOrderTarget.id,
          itemIndex: voidOrderTarget.itemIndex,
          reason,
          voidedByName: userName,
        });
        setVoidOrderTarget(null);
        setViewTransaction(null);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast({ title: 'Item berhasil divoid', icon: 'success' });
      } else {
        await voidOrderMutate.mutateAsync({
          orderId: voidOrderTarget.id,
          reason,
          voidedByName: userName,
          managerPin,
        });
        setVoidOrderTarget(null);
        setViewTransaction(null);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast({ title: 'Order berhasil divoid', icon: 'success' });
      }
    } catch (err: any) {
      setVoidError(err?.response?.data?.error?.message || 'Gagal memvoid order');
    } finally {
      setVoidPending(false);
    }
  };

  const queryClient = useQueryClient();

  return (
    <div className="flex-1 min-h-0 w-full flex overflow-hidden">
      {/* Left: Product Catalog */}
      <section className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          {/* Menu button — toggles action drawer */}
          <button
            onClick={() => setActionDrawerOpen(!actionDrawerOpen)}
            className="flex-shrink-0 w-10 h-10 rounded-lg blue-primary text-white flex items-center justify-center shadow hover:opacity-90 transition"
            title="Aksi kasir"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>

          {/* Search bar */}
          <div className="relative flex-1 max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Cari Produk / Scan Barcode"
              type="text"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <svg
                className="h-6 w-6 text-[#2176D2]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M7 8h10M7 12h10M7 16h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Family Filter */}
        {families.length > 0 && (
          <div className="flex gap-3 flex-wrap mb-4">
            <button
              onClick={() => {
                setSelectedFamily(null);
                setSelectedCategory(null);
              }}
              className={`px-6 py-2 rounded-full font-medium text-sm transition-colors ${
                !selectedFamily
                  ? 'blue-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Semua
            </button>
            {families.map((fam) => (
              <button
                key={fam.id}
                onClick={() => {
                  setSelectedFamily(fam.id);
                  setSelectedCategory(null);
                }}
                className={`px-6 py-2 rounded-full font-medium text-sm transition-colors ${
                  selectedFamily === fam.id
                    ? 'blue-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {fam.name}
              </button>
            ))}
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-3 flex-wrap mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-8 py-2 rounded-full font-medium transition-colors ${
              !selectedCategory
                ? 'blue-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Semua
          </button>
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-8 py-2 rounded-full font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'blue-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : isError || categoriesError ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-red-500 font-medium">Gagal memuat data. Silakan coba lagi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const discount = getProductDiscount(
                activeProductDiscounts,
                product.id,
                product.categoryId,
              );
              const stock = getAvailableStock(product.id);
              const remaining =
                stock !== undefined
                  ? Math.max(0, stock - (cartQtyByProduct[product.id] ?? 0))
                  : undefined;
              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.basePrice}
                  imageUrl={product.imageUrls?.[0] || ''}
                  categoryId={product.categoryId}
                  pricingProfileId={product.pricingProfileId}
                  pricingMode={product.pricingMode}
                  discountPercent={discount?.discountPercent}
                  stock={stock}
                  remaining={remaining}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Right: Cart Sidebar */}
      <aside className="w-[400px] min-h-0 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
        <div className="p-4 border-b border-gray-100 shrink-0 space-y-3">
          {viewTransaction ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">Transaksi</h2>
                <p className="text-sm text-gray-500">{viewTransaction.orderNumber}</p>
              </div>
              <button
                onClick={() => setViewTransaction(null)}
                className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">Pesanan Baru</h2>
                <span className="text-gray-400 font-medium text-sm">{itemCount} item</span>
              </div>
              {activeBillNumber && (
                <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg
                      className="w-4 h-4 shrink-0 text-amber-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-sm font-bold text-amber-800 truncate">
                      Bill {activeBillNumber} terbuka
                    </span>
                  </div>
                  <button
                    onClick={() => discardBill()}
                    className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <input
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setHoldError('');
              }}
              className={`flex-1 px-3 py-2 bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${holdError ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="Nama Customer"
              type="text"
            />
            <input
              value={tableNumber}
              onChange={(e) => {
                setTableNumber(e.target.value);
                setHoldError('');
              }}
              className={`w-24 px-3 py-2 bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center ${holdError ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="No Meja"
              type="text"
            />
          </div>
          {holdError && <p className="text-xs text-red-500 font-medium">{holdError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto order-list-container p-6 space-y-6">
          {viewTransaction ? (
            <>
              {viewTransaction.items.map((item: any, idx: number) => (
                <div key={idx}>
                  <div className="flex items-start justify-between py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400">
                        Qty {item.quantity} × Rp {formatIDR(item.unitPrice ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-medium text-gray-800">
                        Rp {formatIDR(item.totalPrice ?? item.unitPrice * item.quantity)}
                      </span>
                      <button
                        onClick={() => {
                          if (viewTransaction) {
                            setVoidOrderTarget({ id: viewTransaction.id, orderNumber: viewTransaction.orderNumber, itemIndex: idx });
                          }
                        }}
                        className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded font-medium"
                      >
                        Void
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 mt-4" />
                </div>
              ))}
            </>
          ) : items.length === 0 ? (
            <p className="text-gray-400 text-center mt-8">Belum ada item</p>
          ) : (
            items.map((item) => {
              const lineItem = pricing?.lineItems?.find(
                (li) => li.productId === item.productId && li.isFreeItem === !!item.isFreeItem,
              );
              return (
                <div key={`${item.productId}_${item.isFreeItem ? 'free' : 'paid'}`}>
                  <CartItemRow item={item} lineItem={lineItem} />
                  <div className="border-t border-gray-100 mt-6" />
                </div>
              );
            })
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-100 shrink-0 space-y-4">
          <div className="space-y-2">
            {p ? (
              <>
                <div className="flex justify-between text-gray-800 font-medium">
                  <span>Subtotal</span>
                  <span>Rp {formatIDR(p.originalSubtotal - p.promotionDiscount)}</span>
                </div>
                {manualDiscount > 0 && (
                  <div className="flex justify-between text-green-600 text-sm">
                    <span>Diskon Manual</span>
                    <span>- Rp {formatIDR(manualDiscount)}</span>
                  </div>
                )}
                {p.serviceCharge > 0 && (
                  <div className="flex justify-between text-gray-700 text-sm">
                    <span>{p.serviceChargeName}</span>
                    <span>Rp {formatIDR(p.serviceCharge)}</span>
                  </div>
                )}
                {p.tax > 0 && (
                  <div className="flex justify-between text-gray-700 text-sm">
                    <span>
                      {p.taxName} ({p.taxRate}%):
                    </span>
                    <span>Rp {formatIDR(p.tax)}</span>
                  </div>
                )}
                {p.rounding !== 0 && (
                  <div className="flex justify-between text-gray-500 text-sm">
                    <span>Pembulatan</span>
                    <span>
                      {p.rounding > 0 ? '+' : ''}Rp {formatIDR(p.rounding)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span>Rp {formatIDR(items.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-end pt-4">
            <span className="text-2xl font-bold text-gray-800">Total:</span>
            <span className="text-3xl font-extrabold text-gray-900">
              Rp {formatIDR(p?.grandTotal ?? 0)}
            </span>
          </div>
           <div className="flex gap-4 pt-4">
             {viewTransaction ? (
               <>
                 <button
                   onClick={() => {
                     if (!viewTransaction) return;
                     setVoidOrderTarget({
                       id: viewTransaction.id,
                       orderNumber: viewTransaction.orderNumber,
                     });
                   }}
                   disabled={!viewTransaction}
                   className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Void
                 </button>
                 <button
                   onClick={() => {
                     if (!viewTransaction) return;
                     const paid = viewTransaction.paymentBreakdown?.reduce(
                       (s: number, p: any) => s + (p.amount ?? 0),
                       0,
                     ) ?? 0;
                     const change = viewTransaction.paymentBreakdown?.reduce(
                       (s: number, p: any) => s + (p.change ?? 0),
                       0,
                     ) ?? 0;
                     usePOSStore.getState().setReceipt({
                       orderNumber: viewTransaction.orderNumber,
                       displayOrderNumber: viewTransaction.orderNumber,
                       paid,
                       change,
                       grandTotal: viewTransaction.total,
                       paidItems: (viewTransaction.items ?? []).map((i: any) => ({
                         productId: i.productId,
                         name: i.productName,
                         price: i.unitPrice,
                         quantity: i.quantity,
                         isFreeItem: false,
                       })),
                       hasRemaining: false,
                       createdAt: viewTransaction.createdAt,
                       layout: null,
                       thermal: null,
                       pdf: null,
                       templateName: null,
                       pricing: null,
                     });
                   }}
                   className="flex-1 bg-primary-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity"
                 >
                   Print Ulang
                 </button>
               </>
             ) : (
               <>
                 {activeBillId ? (
                   <button
                     onClick={async () => {
                       const ok = await saveBill();
                       setHoldError(ok ? '' : 'Gagal menyimpan bill. Coba lagi.');
                     }}
                     disabled={items.length === 0}
                     className="flex-1 bg-[#9E9E9E] text-white py-4 rounded-xl font-bold hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Simpan Bill
                   </button>
                 ) : (
                   <button
                     onClick={() => {
                       if (items.length === 0) return;
                       if (!customerName.trim() && !tableNumber.trim()) {
                         setHoldError('Isi nama customer atau nomor meja');
                         return;
                       }
                       setHoldError('');
                       openBill();
                     }}
                     disabled={items.length === 0}
                     className="flex-1 bg-[#9E9E9E] text-white py-4 rounded-xl font-bold hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Buka Bill
                   </button>
                 )}
                 <button
                   onClick={openPaymentModal}
                   disabled={items.length === 0}
                   className="flex-[2] blue-primary text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Proses Pembayaran
                 </button>
               </>
             )}
           </div>
        </div>
      </aside>

      <PosActionPanel
        open={actionDrawerOpen}
        onOpenChange={setActionDrawerOpen}
        onViewTransaction={(order: any) => {
          if (items.length > 0 || activeBillNumber) {
            const ok = window.confirm('Pesanan saat ini akan digantikan. Lanjutkan?');
            if (!ok) return;
          }
          setViewTransaction(order);
        }}
      />

      {paymentModalOpen && <PaymentModal />}
      {receipt && <ReceiptDisplay />}

{voidTarget && (
        <PosVoidModal
          title="Void Item"
          description={`Void "${voidTarget.item.name}" (Qty ${voidTarget.item.quantity}) dari bill ${activeBillNumber ?? ''}?`}
          requiresPin={!canVoidSelf}
          isPending={voidPending}
          error={voidError}
          onSubmit={submitVoidItem}
          onClose={() => setVoidTarget(null)}
        />
      )}

      {voidOrderTarget && (
        <PosVoidModal
          title={voidOrderTarget.itemIndex !== undefined ? 'Void Item' : 'Void Transaksi'}
          description={
            voidOrderTarget.itemIndex !== undefined
              ? `Void item dari order ${voidOrderTarget.orderNumber}?`
              : `Void order ${voidOrderTarget.orderNumber}? Transaksi ini akan dibatalkan.`
          }
          requiresPin={!canVoidSelf}
          isPending={voidPending}
          error={voidError}
          onSubmit={submitVoidOrder}
          onClose={() => setVoidOrderTarget(null)}
        />
      )}
    </div>
  );
}
