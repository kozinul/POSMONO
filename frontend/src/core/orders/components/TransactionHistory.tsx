import { useState } from 'react';
import { useRecentOrders } from '../hooks/useOrders';
import { VoidOrderModal } from './VoidOrderModal';
import { VoidItemModal } from './VoidItemModal';
import { VoidPayment } from './VoidPayment';
import type { Order } from '../hooks/useOrders';

type ModalState =
  | { type: null }
  | { type: 'void-order'; order: Order }
  | { type: 'void-item'; order: Order }
  | { type: 'void-payment'; order: Order };

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  preparing: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
  voided: 'bg-red-100 text-red-700',
  'partially-voided': 'bg-orange-100 text-orange-700',
};

export function TransactionHistory() {
  const { data: orders = [], isLoading, refetch } = useRecentOrders(15);
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Transaksi Terakhir</h3>
          <button
            onClick={() => refetch()}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            Belum ada transaksi
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {orders.map((order) => {
              const isExpanded = expandedId === order.id;
              const isVoidable = ['paid', 'confirmed', 'partially-voided'].includes(order.status);
              const hasPayment = order.paymentBreakdown && order.paymentBreakdown.length > 0;

              return (
                <div key={order.id} className="hover:bg-gray-50 transition-colors">
                  <div
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {order.orderNumber}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                          {order.status}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-800 ml-2 whitespace-nowrap">
                        Rp {order.total.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {order.items.length} item &middot; {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-2">
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className={`truncate ${item.isVoided ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {item.productName} x{item.quantity}
                            </span>
                            <span className={`ml-2 whitespace-nowrap ${item.isVoided ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              Rp {(item.subtotal ?? item.totalPrice ?? ((item.unitPrice ?? 0) * (item.quantity ?? 1))).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.voidedItems && order.voidedItems.length > 0 && (
                        <div className="bg-red-50 rounded p-2">
                          <p className="text-[10px] font-medium text-red-700 mb-1">Item Divoid:</p>
                          {order.voidedItems.map((v, idx) => (
                            <p key={idx} className="text-[10px] text-red-600">
                              {v.productName} x{v.quantity} - {v.voidedReason}
                            </p>
                          ))}
                        </div>
                      )}

                      {isVoidable && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ type: 'void-order', order }); }}
                            className="flex-1 px-2 py-1.5 text-[11px] font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                          >
                            Void Order
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ type: 'void-item', order }); }}
                            className="flex-1 px-2 py-1.5 text-[11px] font-medium text-orange-700 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors"
                          >
                            Void Item
                          </button>
                          {hasPayment && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setModal({ type: 'void-payment', order }); }}
                              className="flex-1 px-2 py-1.5 text-[11px] font-medium text-yellow-700 bg-yellow-50 rounded-md hover:bg-yellow-100 transition-colors"
                            >
                              Void Bayar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal.type === 'void-order' && (
        <VoidOrderModal order={modal.order} onClose={() => setModal({ type: null })} />
      )}
      {modal.type === 'void-item' && (
        <VoidItemModal order={modal.order} onClose={() => setModal({ type: null })} />
      )}
      {modal.type === 'void-payment' && (
        <VoidPayment order={modal.order} onClose={() => setModal({ type: null })} />
      )}
    </>
  );
}
