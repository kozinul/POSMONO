import { usePOSStore, CartItem } from '../store/posStore';

interface HeldOrder {
  id: string;
  orderNumber: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  customerName: string;
  tableNumber: string;
  createdAt: string;
}

export function HeldOrdersPanel() {
  const { heldOrders, heldOrdersPanelOpen, toggleHeldOrdersPanel, recallOrder, dismissHeldOrder } = usePOSStore();

  return (
    <>
      {/* Toggle button */}
      {heldOrders.length > 0 && (
        <button
          onClick={toggleHeldOrdersPanel}
          className={`fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 bg-amber-500 text-white px-2 py-4 rounded-r-lg shadow-lg hover:bg-amber-600 transition-all font-bold text-sm ${
            heldOrdersPanelOpen ? 'translate-x-[280px]' : ''
          }`}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          {heldOrders.length} Hold
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-[280px] bg-white border-r border-gray-200 shadow-xl z-30 transform transition-transform duration-300 ${
          heldOrdersPanelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Pesanan Tertunda</h2>
              <p className="text-xs text-gray-400">{heldOrders.length} pesanan</p>
            </div>
            <button
              onClick={toggleHeldOrdersPanel}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Orders list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {heldOrders.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <p className="text-gray-400 text-sm font-medium">Belum ada</p>
                <p className="text-gray-400 text-xs mt-1">Tekan "Hold" untuk menunda</p>
              </div>
            ) : (
              heldOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-xl p-3 hover:border-amber-300 transition-colors"
                >
                  {/* Row 1: order number + table badge + total */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-gray-800 text-xs truncate">{order.orderNumber}</span>
                      {order.tableNumber && (
                        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">
                          M{order.tableNumber}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-extrabold text-gray-900">
                      Rp {order.total.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Row 2: customer name + time */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] text-gray-500 truncate">
                      {order.customerName || '—'}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="text-[11px] text-gray-500 mb-2 leading-relaxed">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.productId} className="truncate">{item.name} x{item.quantity}</div>
                    ))}
                    {order.items.length > 2 && (
                      <div className="text-gray-400">+{order.items.length - 2} lainnya</div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => recallOrder(order)}
                      className="flex-1 blue-primary text-white py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      Recall
                    </button>
                    <button
                      onClick={() => dismissHeldOrder(order.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100 transition-colors font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
