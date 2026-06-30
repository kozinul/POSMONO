import { usePOSStore } from '../store/posStore';

export default function PosPage() {
  const { items, total, addItem, removeItem, clearCart } = usePOSStore();

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex-1 bg-white rounded-lg shadow p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Products</h2>
        <p className="text-gray-500">Product grid will be populated from catalog.</p>
      </div>
      <div className="w-96 bg-white rounded-lg shadow p-4 flex flex-col">
        <h2 className="text-lg font-semibold mb-4">Cart</h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between p-2 bg-gray-50 rounded">
              <span>{item.name}</span>
              <span>Rp {item.price}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>Rp {total.toLocaleString('id-ID')}</span>
          </div>
          <button className="w-full mt-4 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700">
            Pay
          </button>
        </div>
      </div>
    </div>
  );
}
