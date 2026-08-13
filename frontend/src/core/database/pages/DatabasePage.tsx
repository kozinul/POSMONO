import { useState } from 'react';
import Swal from 'sweetalert2';
import { useDatabaseStats, useBackup, useRestore, useDeleteTransactions } from '../hooks/useDatabase';
import { toast } from '../../../@shared/hooks/useToast';

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DatabasePage() {
  const [backupFrom, setBackupFrom] = useState('');
  const [backupTo, setBackupTo] = useState('');
  const [deleteAll, setDeleteAll] = useState(true);
  const [deleteFrom, setDeleteFrom] = useState('');
  const [deleteTo, setDeleteTo] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const { data: stats, refetch: refetchStats } = useDatabaseStats();
  const backupMut = useBackup();
  const restoreMut = useRestore();
  const deleteMut = useDeleteTransactions();

  const handleBackup = async () => {
    try {
      const backup = await backupMut.mutateAsync({
        from: backupFrom || undefined,
        to: backupTo || undefined,
      });
      const c = backup.collections;
      const total = c.orders.length + c.payments.length + c.refunds.length;
      if (total === 0) {
        Swal.fire({
          title: 'Tidak ada data',
          text: 'Tidak ada data transaksi untuk rentang tersebut.',
          icon: 'info',
        });
        return;
      }
      downloadJson(backup, `backup-posmono-${new Date().toISOString().split('T')[0]}.json`);
      toast({ title: `Backup berhasil (${total} record)` });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Backup gagal';
      toast({ title: msg, icon: 'error' });
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast({ title: 'Pilih file backup terlebih dahulu', icon: 'warning' });
      return;
    }
    try {
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);
      const collections = parsed?.collections;
      if (!collections || typeof collections !== 'object') {
        throw new Error('Format file tidak valid. Gunakan file backup dari menu ini.');
      }
      const payload = {
        orders: Array.isArray(collections.orders) ? collections.orders : undefined,
        payments: Array.isArray(collections.payments) ? collections.payments : undefined,
        refunds: Array.isArray(collections.refunds) ? collections.refunds : undefined,
      };
      const counts =
        (payload.orders?.length ?? 0) + (payload.payments?.length ?? 0) + (payload.refunds?.length ?? 0);
      if (counts === 0) {
        Swal.fire({ title: 'File kosong', text: 'File backup tidak berisi data.', icon: 'warning' });
        return;
      }

      const confirmed = await Swal.fire({
        title: 'Restore Data?',
        html: `Akan mengembalikan <b>${counts} record</b> (order / payment / refund).<br/>Data yang sudah ada dengan ID yang sama akan ditimpa.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Restore',
        cancelButtonText: 'Batal',
      });
      if (!confirmed.isConfirmed) return;

      const result = await restoreMut.mutateAsync(payload);
      toast({
        title: `Restore selesai: ${result.orders} order, ${result.payments} payment, ${result.refunds} refund`,
      });
      setRestoreFile(null);
      refetchStats();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Restore gagal';
      toast({ title: msg, icon: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteAll && !deleteFrom && !deleteTo) {
      toast({ title: 'Pilih rentang tanggal atau opsi "Semua data"', icon: 'warning' });
      return;
    }
    if (!deleteAll && deleteFrom && deleteTo && deleteFrom > deleteTo) {
      toast({ title: 'Tanggal "dari" tidak boleh melewati "sampai"', icon: 'warning' });
      return;
    }
    const label = deleteAll ? 'SEMUA data transaksi' : `rentang ${deleteFrom || '…'} s.d. ${deleteTo || '…'}`;

    const confirmed = await Swal.fire({
      title: 'Hapus Data Transaksi',
      html: `<p>Anda akan menghapus <b>${label}</b>.</p><p>Tindakan ini <b>tidak dapat dibatalkan</b>. Pastikan Anda sudah melakukan backup terlebih dahulu.</p>`,
      icon: 'warning',
      input: 'text',
      inputLabel: 'Ketik HAPUS untuk konfirmasi',
      inputPlaceholder: 'HAPUS',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      inputValidator: (val: string) => (val !== 'HAPUS' ? 'Ketik HAPUS untuk mengonfirmasi' : null),
    });
    if (!confirmed.isConfirmed) return;

    try {
      const result = await deleteMut.mutateAsync(
        deleteAll ? {} : { from: deleteFrom || undefined, to: deleteTo || undefined },
      );
      Swal.fire({
        title: 'Data transaksi terhapus',
        html: `Order: <b>${result.orders}</b><br/>Payment: <b>${result.payments}</b><br/>Refund: <b>${result.refunds}</b><br/>Metrik harian: <b>${result.dailyMetrics}</b>`,
        icon: 'success',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Hapus data gagal';
      toast({ title: msg, icon: 'error' });
    }
  };

  const inputClass =
    'block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Database</h1>
          <p className="text-sm text-gray-500 mt-1">
            Backup, restore, dan hapus data transaksi (order, payment, refund).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Order</p>
          <p className="text-2xl font-extrabold text-gray-800 mt-1">{stats?.orders ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Payment</p>
          <p className="text-2xl font-extrabold text-gray-800 mt-1">{stats?.payments ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Refund</p>
          <p className="text-2xl font-extrabold text-gray-800 mt-1">{stats?.refunds ?? 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Backup Data</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Unduh data transaksi sebagai file JSON. Kosongkan tanggal untuk seluruh data.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Dari</label>
            <input type="date" value={backupFrom} onChange={(e) => setBackupFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Sampai</label>
            <input type="date" value={backupTo} onChange={(e) => setBackupTo(e.target.value)} className={inputClass} />
          </div>
          <button
            onClick={handleBackup}
            disabled={backupMut.isPending}
            className="px-5 py-2 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {backupMut.isPending ? 'Memproses...' : 'Download Backup'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Restore Data</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Muat file backup (.json) untuk mengembalikan data transaksi. Data dengan ID yang sama akan ditimpa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex-1 min-w-[220px]">
            <span className="block text-sm font-medium text-gray-600 mb-1.5">File Backup</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
            />
          </label>
          <button
            onClick={handleRestore}
            disabled={restoreMut.isPending}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {restoreMut.isPending ? 'Merestore...' : 'Restore'}
          </button>
        </div>
        {restoreFile && (
          <p className="text-xs text-gray-400">File dipilih: {restoreFile.name}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-red-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-red-700">Hapus Data Transaksi</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Hapus order, payment, dan refund. Catatan: stok produk tidak dikembalikan. Lakukan backup terlebih dahulu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={deleteAll}
              onChange={() => setDeleteAll(true)}
              className="h-4 w-4 text-red-600"
            />
            Semua data
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={!deleteAll}
              onChange={() => setDeleteAll(false)}
              className="h-4 w-4 text-red-600"
            />
            Rentang tanggal
          </label>
          {!deleteAll && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Dari</label>
                <input type="date" value={deleteFrom} onChange={(e) => setDeleteFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Sampai</label>
                <input type="date" value={deleteTo} onChange={(e) => setDeleteTo(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="px-5 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {deleteMut.isPending ? 'Menghapus...' : 'Hapus Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
