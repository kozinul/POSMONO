import { useState } from 'react';
import { useVoidOrder } from '../hooks/useOrders';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import type { Order } from '../hooks/useOrders';

interface VoidOrderModalProps {
  order: Order;
  onClose: () => void;
}

export function VoidOrderModal({ order, onClose }: VoidOrderModalProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const voidOrder = useVoidOrder();

  const canSubmit = reason.trim().length > 0 && confirmed && voidOrder.isPending === false;

  const handleSubmit = () => {
    if (!canSubmit) return;
    voidOrder.mutate(
      { orderId: order.id, reason: reason.trim(), voidedByName: user?.displayName || user?.email || 'Unknown' },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Void Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium">Peringatan</p>
            <p className="text-sm text-red-600 mt-1">
              Anda akan memvoid seluruh order <span className="font-bold">{order.orderNumber}</span>. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order Number</span>
              <span className="font-medium text-gray-800">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-medium text-gray-800">Rp {order.total.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items</span>
              <span className="font-medium text-gray-800">{order.items.length} item</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alasan Void <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masukkan alasan void..."
              rows={3}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              autoFocus
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <span className="text-sm text-gray-600">
              Saya memahami bahwa void ini akan membatalkan seluruh transaksi dan tidak dapat dibatalkan.
            </span>
          </label>

          {voidOrder.isError && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm text-red-600">Gagal memvoid order. Silakan coba lagi.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {voidOrder.isPending ? 'Memproses...' : 'Void Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
