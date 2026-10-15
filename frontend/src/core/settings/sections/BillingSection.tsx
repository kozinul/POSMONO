import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@posmono/shared';
import { api } from '../../../@shared/services/api';
import { formatCurrency } from '../../../@shared/utils/format';
import { useTenant } from '../../../@shared/hooks/useTenant';
import { useAuthStore, hasPermission } from '../../../@shared/hooks/useAuth';
import { toast } from '../../../@shared/hooks/useToast';
import Swal from 'sweetalert2';

interface Invoice {
  id: string;
  number: string;
  planId: string;
  planName?: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'overdue';
  dueDate?: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
}

interface PaymentAttempt {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  referenceNumber?: string;
}

export default function BillingSection() {
  const queryClient = useQueryClient();
  const { data: tenant } = useTenant();
  // The backend pay endpoint is guarded by settings.billing.update (Owner only);
  // hiding the button keeps Manager from seeing a guaranteed 403.
  const user = useAuthStore((s) => s.user);
  const canPay = hasPermission(user, PERMISSIONS.SETTINGS_BILLING_UPDATE);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('transfer');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');

  const { data: entitlement } = useQuery({
    queryKey: ['merchant-entitlement'],
    queryFn: async () => {
      const res = await api.get('/tenants/current/entitlement');
      // Backend replies { success, data } — read the payload, not the envelope.
      return res.data.data as {
        plan?: { name?: string };
        modules?: string[];
        limits?: { maxUsers?: number; maxProducts?: number; maxOutlets?: number };
      };
    },
  });

  const { data: invoicesData, isLoading: invLoading } = useQuery({
    queryKey: ['merchant-invoices'],
    queryFn: async () => {
      const res = await api.get('/tenants/current/subscription/invoices');
      return res.data.data as { items: Invoice[]; totals: { outstanding: number; paid: number } };
    },
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['merchant-payments'],
    queryFn: async () => {
      const res = await api.get('/tenants/current/subscription/payments');
      return res.data.data as { items: PaymentAttempt[] };
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (days: number) => {
      const res = await api.post('/tenants/current/subscription/renew', { days });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Permintaan perpanjangan berhasil. Tagihan baru telah dibuat.', icon: 'success' });
      queryClient.invalidateQueries({ queryKey: ['merchant-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.error?.message || 'Gagal memperpanjang langganan', icon: 'error' });
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({ invoiceId, amount, method, referenceNumber, notes }: any) => {
      const res = await api.post(`/tenants/current/subscription/invoices/${invoiceId}/pay`, {
        amount,
        method,
        referenceNumber,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Pembayaran tagihan berhasil dicatat!', icon: 'success' });
      setPayModalOpen(false);
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['merchant-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-payments'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-entitlement'] });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.error?.message || 'Gagal memproses pembayaran', icon: 'error' });
    },
  });

  const handleOpenPay = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.amount);
    setPayMethod('transfer');
    setRefNumber('');
    setNotes('');
    setPayModalOpen(true);
  };

  const handleRenew = async () => {
    const result = await Swal.fire({
      title: 'Perpanjang Langganan (30 Hari)',
      text: 'Buat tagihan baru untuk memperpanjang langganan toko Anda selama 30 hari?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Buat Tagihan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#4f46e5',
    });
    if (result.isConfirmed) {
      renewMutation.mutate(30);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Lunas</span>;
      case 'pending':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Belum Lunas</span>;
      case 'overdue':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">Jatuh Tempo</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">Dibatalkan</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Langganan & Tagihan (Member Area)</h2>
        <p className="text-sm text-slate-500">Kelola paket langganan toko, lihat riwayat tagihan, dan simulasi pembayaran.</p>
      </div>

      {/* Subscription Status Card */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-bold rounded-full uppercase tracking-wider">
                Paket Saat Ini
              </span>
              <span className="text-xl font-extrabold">{entitlement?.plan?.name || tenant?.businessType || 'Trial / Pro'}</span>
            </div>
            <p className="text-indigo-200 text-sm mt-2">
              Masa Aktif: <strong className="text-white">{tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString('id-ID', { dateStyle: 'long' }) : 'Selamanya / Aktif'}</strong>
            </p>
          </div>
          <button
            onClick={handleRenew}
            disabled={renewMutation.isPending}
            className="px-4 py-2.5 bg-white text-indigo-900 font-semibold rounded-lg hover:bg-indigo-50 transition shadow text-sm disabled:opacity-50"
          >
            {renewMutation.isPending ? 'Memproses...' : '+ Perpanjang 30 Hari'}
          </button>
        </div>

        {entitlement?.limits && (
          <div className="mt-6 pt-4 border-t border-indigo-700/60 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-indigo-300 block text-xs">Maks Pengguna</span>
              <span className="font-bold text-lg">{entitlement.limits.maxUsers ?? 'Tak Terbatas'}</span>
            </div>
            <div>
              <span className="text-indigo-300 block text-xs">Maks Produk</span>
              <span className="font-bold text-lg">{entitlement.limits.maxProducts ?? 'Tak Terbatas'}</span>
            </div>
            <div>
              <span className="text-indigo-300 block text-xs">Maks Cabang</span>
              <span className="font-bold text-lg">{entitlement.limits.maxOutlets ?? 'Tak Terbatas'}</span>
            </div>
            <div>
              <span className="text-indigo-300 block text-xs">Modul Aktif</span>
              <span className="font-bold text-sm truncate block" title={entitlement.modules?.join(', ')}>
                {entitlement.modules?.join(', ') || 'Semua'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Daftar Tagihan (Invoices)</h3>
          <span className="text-xs text-slate-500">
            Total Outstanding: <strong className="text-rose-600">{formatCurrency(invoicesData?.totals?.outstanding || 0)}</strong>
          </span>
        </div>

        {invLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Memuat data tagihan...</div>
        ) : invoicesData?.items && invoicesData.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">No. Tagihan</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dibuat</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {invoicesData.items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{inv.number}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {new Date(inv.periodStart).toLocaleDateString()} — {new Date(inv.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{formatCurrency(inv.amount)}</td>
                    <td className="py-3 px-4">{getStatusBadge(inv.status)}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {inv.status === 'pending' || inv.status === 'overdue' ? (
                        canPay ? (
                          <button
                            onClick={() => handleOpenPay(inv)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs shadow-sm transition"
                          >
                            Bayar / Simulasi
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Butuh izin Owner
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400 italic">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-sm">Belum ada tagihan langganan.</div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800">Riwayat Pembayaran Berhasil</h3>
        </div>
        {paymentsData?.items && paymentsData.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">ID Transaksi / Ref</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Jumlah</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paymentsData.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{p.referenceNumber || p.id}</td>
                    <td className="py-3 px-4 uppercase text-xs font-semibold text-indigo-700">{p.method}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-sm">Belum ada riwayat pembayaran.</div>
        )}
      </div>

      {/* Payment Simulation Modal */}
      {payModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-indigo-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Simulasi Pembayaran Tagihan</h3>
              <button
                onClick={() => setPayModalOpen(false)}
                className="text-indigo-200 hover:text-white font-bold text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs text-slate-500 block">No. Tagihan</span>
                <span className="font-mono font-bold text-slate-900">{selectedInvoice.number}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Tagihan</span>
                <span className="text-xl font-extrabold text-indigo-600">{formatCurrency(selectedInvoice.amount)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Pembayaran</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="transfer">Transfer Bank (BCA / Mandiri / BNI)</option>
                  <option value="qris">QRIS (GoPay / OVO / Dana / BCA)</option>
                  <option value="card">Kartu Kredit / Debit</option>
                  <option value="ewallet">E-Wallet (ShopeePay)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal Dibayar (Rp)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">No. Referensi / Bukti Transfer (Opsional)</label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Cth: TRF-88912345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan (Opsional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Catatan pembayaran..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={payMutation.isPending}
                  onClick={() =>
                    payMutation.mutate({
                      invoiceId: selectedInvoice.id,
                      amount: payAmount,
                      method: payMethod,
                      referenceNumber: refNumber,
                      notes,
                    })
                  }
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
                >
                  {payMutation.isPending ? 'Memproses...' : 'Konfirmasi Bayar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
