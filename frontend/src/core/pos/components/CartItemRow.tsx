import { CartItem, usePOSStore } from '../store/posStore';

interface CartItemRowProps {
  item: CartItem;
}

export function CartItemRow({ item }: CartItemRowProps) {
  const updateQuantity = usePOSStore((s) => s.updateQuantity);
  const removeItem = usePOSStore((s) => s.removeItem);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-800 truncate">
            {item.name} x{item.quantity}
          </h4>
          {item.notes && (
            <p className="text-sm text-gray-400 truncate">{item.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="font-medium text-gray-800">
            Rp {(item.price * item.quantity).toLocaleString('id-ID')}
          </span>
          <div className="flex items-center gap-1">
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
          </div>
          <button
            onClick={() => removeItem(item.productId)}
            className="text-gray-300 hover:text-red-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
