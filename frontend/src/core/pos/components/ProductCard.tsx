import { usePOSStore } from '../store/posStore';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  categoryId?: string;
  pricingProfileId?: string;
  stock?: number;
  isOutOfStock?: boolean;
}

export function ProductCard({ id, name, price, imageUrl, categoryId, pricingProfileId, stock = 0, isOutOfStock = false }: ProductCardProps) {
  const addItem = usePOSStore((s) => s.addItem);

  return (
    <div
      className={`product-card bg-white rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-100 ${
        isOutOfStock ? 'opacity-60 relative' : ''
      }`}
    >
      <div className="relative">
        <img
          alt={name}
          className="h-40 w-full object-cover"
          src={imageUrl || '/placeholder.svg'}
        />
        {isOutOfStock && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Habis
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-800 truncate">{name}</h3>
        <p className="text-gray-900 mt-1">
          Rp {price.toLocaleString('id-ID')}
        </p>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className={`text-xs ${isOutOfStock ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
            {isOutOfStock ? 'Stok: Habis' : `Stok: ${stock}`}
          </span>
          <button
            onClick={() => addItem({ productId: id, name, price, imageUrl, categoryId, pricingProfileId })}
            disabled={isOutOfStock}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
              isOutOfStock
                ? 'bg-gray-300 text-white cursor-not-allowed'
                : 'blue-primary text-white hover:opacity-90 transition-opacity'
            }`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
