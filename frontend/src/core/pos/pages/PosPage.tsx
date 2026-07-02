import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOSStore } from '../store/posStore';
import { useProducts, useCategories, useBarcodeLookup } from '../hooks/useProducts';
import { useTenant } from '../../../@shared/hooks/useTenant';
import { useTaxConfiguration } from '../../../@shared/hooks/useTaxConfiguration';
import { useDiscountConfiguration } from '../../../@shared/hooks/useDiscountConfiguration';
import { ProductCard } from '../components/ProductCard';
import { CartItemRow } from '../components/CartItemRow';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptDisplay } from '../components/ReceiptDisplay';

export default function PosPage() {
  const {
    items,
    subtotal,
    serviceCharge,
    serviceChargeName,
    tax,
    taxName,
    discount,
    discountType,
    discountAmount,
    promoCode,
    promoApplied,
    total,
    paymentModalOpen,
    receipt,
    openPaymentModal,
    setTaxConfig,
    setDiscountRules,
    setPromoCode,
  } = usePOSStore();

  const { data: taxConfig } = useTaxConfiguration();
  const { data: discountConfig } = useDiscountConfiguration();

  useEffect(() => {
    if (taxConfig) {
      setTaxConfig(taxConfig);
    }
  }, [taxConfig, setTaxConfig]);

  useEffect(() => {
    if (discountConfig?.rules) {
      setDiscountRules(discountConfig.rules);
    }
  }, [discountConfig, setDiscountRules]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>();

  const { lookupBarcode } = useBarcodeLookup();

  const handleBarcodeInput = useCallback(async (barcode: string) => {
    const product = await lookupBarcode(barcode);
    if (product) {
      searchRef.current?.blur();
    }
  }, [lookupBarcode]);

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

  const { data: products = [], isLoading, isError } = useProducts(
    search || undefined,
    selectedCategory ?? undefined,
  );
  const { data: categories = [], isError: categoriesError } = useCategories();

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Product Catalog */}
      <section className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="space-y-6 mb-6">
          {/* Search */}
          <div className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
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
              <svg className="h-6 w-6 text-[#2176D2]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 8h10M7 12h10M7 16h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-3 flex-wrap">
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
            {categories.map((cat) => (
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
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.basePrice}
                imageUrl={product.imageUrls?.[0] || ''}
                categoryId={product.categoryId}
                pricingProfileId={(product as any).pricingProfileId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Right: Cart Sidebar */}
      <aside className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Pesanan Baru</h2>
          <span className="text-gray-400 font-medium">{items.length} item</span>
        </div>

        <div className="flex-1 overflow-y-auto order-list-container p-6 space-y-6">
          {items.length === 0 ? (
            <p className="text-gray-400 text-center mt-8">Belum ada item</p>
          ) : (
            items.map((item) => (
              <div key={item.productId}>
                <CartItemRow item={item} />
                <div className="border-t border-gray-100 mt-6" />
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-100 shrink-0 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal:</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>{serviceChargeName}:</span>
                <span>Rp {serviceCharge.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>{taxName}:</span>
              <span>Rp {tax.toLocaleString('id-ID')}</span>
            </div>
            {promoApplied && promoApplied.appliedRules.length > 0 && (
              <div className="space-y-1">
                {promoApplied.appliedRules.map((r) => (
                  <div key={r.ruleId} className="flex justify-between text-green-600 text-sm">
                    <span>{r.ruleName}:</span>
                    <span>- Rp {r.discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon Manual {discountType === 'percentage' ? `(${discount}%)` : ''}:</span>
                <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-end pt-4">
            <span className="text-2xl font-bold text-gray-800">Total:</span>
            <span className="text-3xl font-extrabold text-gray-900">
              Rp {total.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex gap-4 pt-4">
            <button className="flex-1 bg-[#9E9E9E] text-white py-4 rounded-xl font-bold hover:bg-gray-500 transition-colors">
              Hold
            </button>
            <button
              onClick={openPaymentModal}
              disabled={items.length === 0}
              className="flex-[2] blue-primary text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proses Pembayaran
            </button>
          </div>
        </div>
      </aside>

      {paymentModalOpen && <PaymentModal />}
      {receipt && <ReceiptDisplay />}
    </div>
  );
}
