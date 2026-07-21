import { useState } from 'react';
import { useVoidItem } from '../hooks/useOrders';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import type { Order } from '../hooks/useOrders';

interface VoidItemModalProps {
  order: Order;
  onClose: () => void;
}

export function VoidItemModal({ order, onClose }: VoidItemModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const voidItem = useVoidItem();

  const activeItems = order.items.filter((item) => !item.isVoided);
  const canSubmit = selectedIndex !== null && reason.trim().length > 0 && confirmed && !voidItem.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    voidItem.mutate(
      {
        orderId: order.id,
        itemIndex: selectedIndex,
        reason: reason.trim(),
        voidedByName: user?.displayName || user?.email || 'Unknown',
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Void Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium">Pilih Item untuk Dihapus</p>
            <p className="text-sm text-yellow-600 mt-1">
              Pilih item dari order <span className="font-bold">{order.orderNumber}</span> yang ingin divoid.
            </p>
          </div>

          {activeItems.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              Semua item sudah divoid atau tidak ada item tersisa.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {order.items.map((item, idx) => {
                if (item.isVoided) return null;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedIndex === idx
                        ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      selectedIndex === idx ? 'border-red-500' : 'border-gray-300'
                    }`}>
                      {selectedIndex === idx && (
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity} x Rp {(item.unitPrice ?? 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-800">
                      Rp {(item.subtotal ?? item.totalPrice ?? ((item.unitPrice ?? 0) * (item.quantity ?? 1))).toLocaleString('id-ID')}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alasan Void <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masukkan alasan void item..."
              rows={2}
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
              Saya memahami bahwa void item ini tidak dapat dibatalkan.
            </span>
          </label>

          {voidItem.isError && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm text-red-600">Gagal memvoid item. Silakan coba lagi.</p>
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
              {voidItem.isPending ? 'Memproses...' : 'Void Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
