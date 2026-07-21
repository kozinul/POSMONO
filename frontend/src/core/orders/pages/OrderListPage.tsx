import { useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { VoidOrderModal } from '../components/VoidOrderModal';
import { VoidItemModal } from '../components/VoidItemModal';
import { VoidPayment } from '../components/VoidPayment';
import { formatCurrency } from '../../../@shared/utils/format';
import type { Order } from '../hooks/useOrders';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  preparing: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
  voided: 'bg-red-100 text-red-800',
  'partially-voided': 'bg-orange-100 text-orange-800',
};

type ModalState =
  | { type: null }
  | { type: 'void-order'; order: Order }
  | { type: 'void-item'; order: Order }
  | { type: 'void-payment'; order: Order };

export default function OrderListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>({ type: null });

  const { data, isLoading, isError, refetch } = useOrders({
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 20,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
              <option value="voided">Voided</option>
              <option value="partially-voided">Partially Voided</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 inline-block">
              <p className="text-red-700 mb-2">Failed to load orders</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.data.map((order) => {
                  const isVoidable = ['paid', 'confirmed', 'partially-voided'].includes(order.status);
                  const hasPayment = order.paymentBreakdown && order.paymentBreakdown.length > 0;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{order.items.length}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(order.total)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{order.paymentStatus}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isVoidable && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModal({ type: 'void-order', order })}
                              className="px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                              title="Void entire order"
                            >
                              Void
                            </button>
                            <button
                              onClick={() => setModal({ type: 'void-item', order })}
                              className="px-2 py-1 text-[11px] font-medium text-orange-700 bg-orange-50 rounded hover:bg-orange-100 transition-colors"
                              title="Void specific item"
                            >
                              Item
                            </button>
                            {hasPayment && (
                              <button
                                onClick={() => setModal({ type: 'void-payment', order })}
                                className="px-2 py-1 text-[11px] font-medium text-yellow-700 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors"
                                title="Void payment"
                              >
                                Bayar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.meta && (
              <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  Page {data.meta.page} of {Math.ceil(data.meta.total / (data.meta.limit || 20))}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= Math.ceil((data.meta?.total || 0) / (data.meta?.limit || 20))}
                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center text-gray-500">
            No orders found
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
    </div>
  );
}
