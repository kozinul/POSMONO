import { CartItem, usePOSStore } from '../store/posStore';
import type { PricingLineItem } from '../../../@shared/hooks/usePricing';

interface CartItemRowProps {
  item: CartItem;
  lineItem?: PricingLineItem;
}

export function CartItemRow({ item, lineItem }: CartItemRowProps) {
  const updateQuantity = usePOSStore((s) => s.updateQuantity);
  const removeItem = usePOSStore((s) => s.removeItem);

  const origTotal = item.price * item.quantity;
  const isFree = item.isFreeItem;
  const displayTotal = lineItem && !isFree
    ? lineItem.lineTotal
    : isFree ? 0 : origTotal;
  const itemDiscount = lineItem && !isFree
    ? (lineItem.originalUnitPrice * lineItem.quantity) - lineItem.lineTotal
    : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-800 truncate">
            {item.name}
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            {isFree && (
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                GRATIS
              </span>
            )}
            {item.pricingMode && (
              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                item.pricingMode === 'inclusive'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-orange-50 text-orange-600'
              }`}>
                {item.pricingMode === 'inclusive' ? 'Nett (pajak termasuk)' : '++ (pajak terpisah)'}
              </span>
            )}
          </div>
          {item.notes && (
            <p className="text-sm text-gray-400 truncate">{item.notes}</p>
          )}
          <p className="text-gray-500 text-sm mt-0.5">
            Rp {item.price.toLocaleString('id-ID')} × {item.quantity}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {isFree ? (
            <span className="font-medium text-green-600">GRATIS</span>
          ) : (
            <div className="text-right">
              <span className="font-semibold text-gray-800">
                Rp {origTotal.toLocaleString('id-ID')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!isFree && (
              <>
                <button
                  onClick={() => updateQuantity(item.productId, -1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-medium text-gray-700">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.productId, 1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold"
                >
                  +
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => removeItem(item.productId)}
            className="text-gray-300 hover:text-red-500 transition-colors"
            title="Hapus dari keranjang"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>

      {itemDiscount > 0 && (
        <div className="flex justify-between items-center pl-2 pt-1 text-xs">
          <span className="text-green-700 font-medium">🏷 Promo</span>
          <span className="text-green-600 font-semibold">- Rp {itemDiscount.toLocaleString('id-ID')}</span>
        </div>
      )}


    </div>
  );
}
