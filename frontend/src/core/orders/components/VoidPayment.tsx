import { useState } from 'react';
import { api } from '../../../@shared/services/api';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { Order, IPaymentBreakdownEntry } from '../hooks/useOrders';

interface VoidPaymentProps {
  order: Order;
  onClose: () => void;
}

export function VoidPayment({ order, onClose }: VoidPaymentProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<'idle' | 'processing' | 'error'>('idle');
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const payments = order.paymentBreakdown || [];
  const canSubmit = selectedIndex !== null && reason.trim().length > 0 && confirmed && state !== 'processing';

  const handleSubmit = async () => {
    if (!canSubmit || selectedIndex === null) return;
    setState('processing');
    try {
      await api.post(`/orders/${order.id}/void-payment`, {
        paymentIndex: selectedIndex,
        reason: reason.trim(),
        voidedByName: user?.displayName || user?.email || 'Unknown',
      });
      qc.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    } catch {
      setState('error');
    }
  };

  const formatMethod = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Tunai',
      qris: 'QRIS',
      transfer: 'Transfer Bank',
      card: 'Kartu Debit/Kredit',
    };
    return labels[method] || method;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Void Pembayaran</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800 font-medium">Void Pembayaran</p>
            <p className="text-sm text-orange-600 mt-1">
              Pilih metode pembayaran dari order <span className="font-bold">{order.orderNumber}</span> yang ingin divoid.
            </p>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              Tidak ada pembayaran pada order ini.
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((payment, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  disabled={payment.method === 'cash' && payments.filter((p) => p.method === 'cash').length <= 1 && payments.length === 1}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedIndex === idx
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-200'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    selectedIndex === idx ? 'border-orange-500' : 'border-gray-300'
                  }`}>
                    {selectedIndex === idx && (
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{formatMethod(payment.method)}</p>
                    <p className="text-xs text-gray-500">{payment.code}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-800">
                    Rp {payment.amount.toLocaleString('id-ID')}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alasan Void <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masukkan alasan void pembayaran..."
              rows={2}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-gray-600">
              Saya memahami bahwa void pembayaran ini akan mengembalikan status order.
            </span>
          </label>

          {state === 'error' && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm text-red-600">Gagal memvoid pembayaran. Silakan coba lagi.</p>
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
              className="flex-1 py-3 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {state === 'processing' ? 'Memproses...' : 'Void Pembayaran'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
