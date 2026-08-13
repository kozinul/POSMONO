import { useDashboardSummary } from '../../orders/hooks/useOrders';
import { useTenant } from '../../../@shared/hooks/useTenant';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../../@shared/utils/format';
import { useRefundable, useRefundMutation, refundReference, type RefundablePayment } from '../../payments/hooks/useRefund';
import { useAuthStore, hasPermission } from '../../../@shared/hooks/useAuth';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import Swal from 'sweetalert2';

export default function DashboardPage() {
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();
  const { data: tenant } = useTenant();
  const user = useAuthStore((s) => s.user);
  const canRefund = hasPermission(user, 'payments:write');
  const { data: refundable } = useRefundable();
  const refundMutation = useRefundMutation();

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

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-700 mb-2">Failed to load dashboard data</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {tenant && <span className="text-sm text-gray-500">{tenant.name}</span>}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Today's Revenue</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {summary ? formatCurrency(summary.todayRevenue) : 'Rp 0'}
          </p>
          {summary && summary.totalRounding != null && summary.totalRounding !== 0 && (
            <p className="mt-1 text-xs text-purple-600 font-medium">
              Pembulatan {summary.totalRounding > 0 ? '+' : '-'}
              {formatCurrency(Math.abs(summary.totalRounding))} (termasuk revenue)
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Orders Today</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {summary?.todayOrders ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Pending Orders</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {summary?.pendingOrders ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Low Stock Items</h3>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {summary?.lowStockCount ?? 0}
          </p>
        </div>
      </div>

      {canRefund && refundable && refundable.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Refund Transaksi</h2>
              <p className="text-sm text-gray-500">Transaksi dari shift yang sudah ditutup. Void hanya untuk shift yang masih berjalan.</p>
            </div>
            <Link to="/reports" className="text-sm text-primary-600 hover:text-primary-700">
              Laporan Refund
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kasir</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pembayaran</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {refundable.slice(0, 10).map((p) => (
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
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRefund(p)}
                        disabled={refundMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Refund
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary && summary.recentOrders.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link to="/orders" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kasir</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal & Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summary.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'paid' || order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'confirmed' || order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'held' || order.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'voided' ? 'bg-red-100 text-red-700' :
                        order.status === 'partially-voided' ? 'bg-orange-100 text-orange-700' :
                        order.status === 'cancelled' || order.status === 'refunded' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {{
                          paid: 'Lunas',
                          completed: 'Selesai',
                          confirmed: 'Terkonfirmasi',
                          preparing: 'Dibuat',
                          held: 'Draft',
                          draft: 'Draft',
                          voided: 'Void',
                          'partially-voided': 'Sebagian Void',
                          cancelled: 'Batal',
                          refunded: 'Refund',
                        }[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{order.cashierName || 'Kasir'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(order.total + (order.roundingAdjustment ?? 0))}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
