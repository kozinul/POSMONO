import { useState } from 'react';
import Swal from 'sweetalert2';
import { usePlatformHubs, usePlatformOutlets, usePlatformDeleteOutlet, type PlatformOutletRow } from '../../../@shared/hooks/usePlatform';
import { SectionTitle, cardCls, inputCls } from '../components/platformUi';
import CreateOutletModal from './CreateOutletModal';
import EditOutletModal from '../components/EditOutletModal';

export default function OutletsSection() {
  const { data: hubs = [] } = usePlatformHubs();
  const [hubId, setHubId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOutlet, setEditOutlet] = useState<PlatformOutletRow | null>(null);
  const deleteOutlet = usePlatformDeleteOutlet();
  const { data: outlets = [], isLoading } = usePlatformOutlets({ hubId: hubId || undefined });

  const handleDeleteOutlet = async (o: PlatformOutletRow) => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Hapus Outlet?',
      html: `<p style="color:#991b1b;margin:0 0 8px"><b>${o.name}</b> akan dihapus PERMANEN.</p><p style="color:#6b7280;font-size:13px;text-align:left">Warehouse terkait juga akan dihapus. Data order/pembayaran historis tetap tersimpan. Alasan penghapusan :</p>`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Alasan penghapusan (opsional)',
      inputAttributes: { rows: '3' },
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async (val: string) => {
        try {
          await deleteOutlet.mutateAsync({ outletId: o.id, tenantId: o.tenantId, reason: val?.trim() || 'Permintaan penghapusan outlet' });
          return true;
        } catch (err: any) {
          const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Gagal menghapus outlet';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({ title: 'Outlet Dihapus', text: `Outlet "${o.name}" telah dihapus permanen.`, icon: 'success', timer: 2500, showConfirmButton: false });
    }
  };

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <SectionTitle>Outlet Lintas-Tenant</SectionTitle>
        <div className="flex items-center gap-3">
          <select className={inputCls + ' w-72'} value={hubId} onChange={(e) => setHubId(e.target.value)}>
            <option value="">Semua Hub</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
          >
            + Tambah Outlet
          </button>
        </div>
      </div>
      <CreateOutletModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {editOutlet && <EditOutletModal outlet={editOutlet} onClose={() => setEditOutlet(null)} />}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Telepon</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            ) : outlets.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Tidak ada outlet.</td></tr>
            ) : outlets.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{o.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{o.tenantName ?? o.tenantId}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{o.phone || '-'}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{o.isActive ? 'Aktif' : 'Nonaktif'}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => setEditOutlet(o)}
                    className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteOutlet(o)}
                    disabled={deleteOutlet.isPending}
                    className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

