import { useState, useMemo } from 'react';
import { useRefundable, useRefundMutation, refundReference, type RefundablePayment } from '../../payments/hooks/useRefund';
import { useAuthStore, hasPermission } from '../../../@shared/hooks/useAuth';
import { formatCurrency } from '../../../@shared/utils/format';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import Swal from 'sweetalert2';

export default function RefundPage() {
  const user = useAuthStore((s) => s.user);
  const canRefund = hasPermission(user, 'payments:write');

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: refundable, isLoading, isError, refetch } = useRefundable(dateFrom || undefined, dateTo || undefined);
  const refundMutation = useRefundMutation();

  const filtered = useMemo(() => {
    if (!refundable) return [];
    if (!search.trim()) return refundable;
    const q = search.trim().toLowerCase();
    return refundable.filter(
      (p) =>
        p.orderNumber.toLowerCase().includes(q) ||
        (p.cashierName && p.cashierName.toLowerCase().includes(q)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)),
    );
  }, [refundable, search]);

  const handleRefund = (p: RefundablePayment) => {
    void Swal.fire({
      title: 'Refund Transaksi',
      html: `
        <div class="text-left text-sm space-y-1">
          <p><strong>No. Order:</strong> ${p.orderNumber}</p>
          <p><strong>Kasir:</strong> ${p.cashierName || '-'}</p>
          <p><strong>Pembayaran:</strong> ${paymentMethodLabel(p.method)}${p.method !== 'cash' ? ` (${refundReference(p)})` : ''}</p>
          <p><strong>Jumlah:</strong> ${formatCurrency(p.amount)}</p>
        </div>`,
      input: 'textarea',
      inputLabel: 'Alasan refund',
      inputPlaceholder: 'Tuliskan alasan refund...',
      inputValidator: (v: string) => (!v || !v.trim() ? 'Alasan refund wajib diisi' : undefined),
      showCancelButton: true,
      confirmButtonText: 'Refund',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      showLoaderOnConfirm: true,
      preConfirm: async (reason) => {
        try {
          await refundMutation.mutateAsync({
            paymentId: p.paymentId,
            reason,
            refundedByName: user?.displayName ?? '',
          });
        } catch (err: unknown) {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Refund gagal';
          Swal.showValidationMessage(message);
          throw err;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        void Swal.fire({
          title: 'Berhasil',
          text: `Transaksi ${p.orderNumber} telah direfund.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
      }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refund Transaksi</h1>
          <p className="text-sm text-gray-500 mt-1">Daftar transaksi dari shift yang sudah ditutup dan bisa direfund.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] max-w-md">
            <label className="block text-xs font-medium text-gray-500 mb-1">Cari No. Order / Kasir / Referensi</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cari transaksi..."
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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
              <p className="text-red-700 mb-2">Gagal memuat data transaksi</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : filtered.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kasir</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pembayaran</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                {canRefund && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((p) => (
                <tr key={p.paymentId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.cashierName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {paymentMethodLabel(p.method)}
                    {p.method !== 'cash' && (
                      <span className="ml-1 text-xs text-gray-400">({refundReference(p)})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(p.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {p.paidAt
                      ? new Date(p.paidAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                  {canRefund && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRefund(p)}
                        disabled={refundMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Refund
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-gray-500">
            {search || dateFrom || dateTo
              ? 'Tidak ada transaksi yang cocok dengan filter'
              : 'Tidak ada transaksi yang bisa direfund'}
          </div>
        )}
      </div>
    </div>
  );
}
