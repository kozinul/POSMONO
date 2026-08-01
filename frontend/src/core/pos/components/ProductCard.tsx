import { usePOSStore } from '../store/posStore';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  categoryId?: string;
  pricingProfileId?: string;
  pricingMode?: 'inclusive' | 'exclusive';
  stock?: number;
  remaining?: number;
  discountPercent?: number;
}

export function ProductCard({ id, name, price, imageUrl, categoryId, pricingProfileId, pricingMode, stock, remaining, discountPercent }: ProductCardProps) {
  const addItem = usePOSStore((s) => s.addItem);
  const hasDiscount = discountPercent && discountPercent > 0;
  const isTracked = stock !== undefined && stock > 0;
  const isSoldOut = isTracked && (remaining ?? stock) <= 0;

  return (
    <div
      className={`product-card bg-white rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-100 ${
        isSoldOut ? 'opacity-60 relative' : ''
      }`}
    >
      <div className="relative">
        <img
          alt={name}
          className="h-40 w-full object-cover"
          src={imageUrl || '/placeholder.svg'}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== window.location.origin + '/placeholder.svg') {
              img.onerror = null;
              img.src = '/placeholder.svg';
            }
          }}
        />
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            -{discountPercent}%
          </span>
        )}
        {isSoldOut && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Habis
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-800 truncate">{name}</h3>
        <div className="flex items-center gap-2 mt-1">
          {hasDiscount && (
            <span className="text-gray-400 line-through text-sm">
              Rp {price.toLocaleString('id-ID')}
            </span>
          )}
          <p className={`font-semibold ${hasDiscount ? 'text-red-600' : 'text-gray-900'}`}>
            Rp {hasDiscount ? Math.round(price * (1 - discountPercent / 100)).toLocaleString('id-ID') : price.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className={`text-xs ${isSoldOut ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
            {isTracked ? `Stok: ${remaining ?? stock}` : 'Stok: ∞'}
          </span>
          <button
            onClick={() => addItem({ productId: id, name, price, imageUrl, categoryId, pricingProfileId, pricingMode, stock })}
            disabled={isSoldOut}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
              isSoldOut
                ? 'bg-gray-300 text-white cursor-not-allowed'
                : 'blue-primary text-white hover:opacity-90 transition-opacity'
            }`}
          >
            {isSoldOut ? 'Habis' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
