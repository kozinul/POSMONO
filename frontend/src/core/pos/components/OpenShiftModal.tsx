import { useState } from 'react';
import { useOpenShiftMutation } from '../../shifts/hooks/useShift';
import { useCarriedBills } from '../../shifts/hooks/useCarriedBills';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { formatIDR } from '../utils/money';

interface OpenShiftModalProps {
  onClose?: () => void;
  error?: string | null;
  onRetry?: () => void;
}

export function OpenShiftModal({ onClose, error, onRetry }: OpenShiftModalProps) {
  const logout = useAuthStore((s) => s.logout);
  const [balance, setBalance] = useState('0');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const openMut = useOpenShiftMutation();
  const { data: carriedBills } = useCarriedBills();

  const carriedCount = carriedBills?.count ?? 0;
  const carriedTotal = carriedBills?.totalAmount ?? 0;

  const handleSubmit = () => {
    if (openMut.isPending) return;
    setSubmitError(null);
    openMut.mutate(
      { openingBalance: parseInt(balance.replace(/\D/g, ''), 10) || 0 },
      {
        onError: (err: any) => {
          const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Gagal membuka shift';
          setSubmitError(msg);
        },
      },
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Buka Shift</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Tutup"
          >
            ✕
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Mulai transaksi dengan membuka shift terlebih dahulu. Keranjang &amp; bill yang belum
        dibayar akan tetap tersimpan.
      </p>
      {carriedCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm font-medium text-amber-800">
            Ada {carriedCount} bill menggantung dari shift sebelumnya.
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Total Rp {formatIDR(carriedTotal)} · buka lewat ☰ &gt; Daftar Bill.
          </p>
        </div>
      )}
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Saldo Buka Kasir (Rp)
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        placeholder="0"
        className="block w-full px-3 py-2.5 text-lg font-bold text-right border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        autoFocus
        disabled={openMut.isPending}
      />
      {(submitError || error) && (
        <div className="mt-3 bg-red-50 rounded-xl p-3 text-center border border-red-200">
          <p className="text-sm text-red-600 font-medium">{submitError || error}</p>
          {error && onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 px-3 py-1 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Coba Lagi
            </button>
          )}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={openMut.isPending}
        className="mt-4 w-full py-3 rounded-xl font-bold text-white blue-primary hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {openMut.isPending ? 'Membuka Shift...' : 'Buka Shift'}
      </button>

      <button
        onClick={logout}
        className="mt-3 w-full py-2.5 rounded-xl font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
      >
        Logout &amp; Ganti Pengguna
      </button>
    </div>
  );
}