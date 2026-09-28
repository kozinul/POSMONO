import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { usePlatformDeleteHub, usePlatformUpdateHub, type PlatformHubDetail } from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  Badge,
  ErrorNote,
  apiErrorMessage,
  cardCls,
  dangerBtnCls,
  ghostBtnCls,
  inputCls,
  primaryBtnCls,
  smallPillBtnCls,
} from './platformUi';

function hubErrorMessage(e: unknown, fallback: string): string {
  const msg = apiErrorMessage(e, fallback);
  if (/already exists/i.test(msg)) return 'Nama hub sudah dipakai.';
  if (/assigned tenants/i.test(msg)) return 'Lepas semua tenant dari hub sebelum menghapus.';
  return msg;
}

export default function HubProfileCard({
  hub,
  memberCount,
  canManage,
  onDeleted,
  onViewConsolidated,
}: {
  hub: PlatformHubDetail;
  memberCount: number;
  canManage: boolean;
  onDeleted: () => void;
  onViewConsolidated: (hubId: string) => void;
}) {
  const updateHub = usePlatformUpdateHub();
  const deleteHub = usePlatformDeleteHub();
  const [name, setName] = useState(hub.name);
  const [description, setDescription] = useState(hub.description ?? '');
  const [isActive, setIsActive] = useState(hub.isActive);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(hub.name);
    setDescription(hub.description ?? '');
    setIsActive(hub.isActive);
    setDirty(false);
    setError('');
  }, [hub.id, hub.name, hub.description, hub.isActive, hub.updatedAt]);

  const isBusy = updateHub.isPending || deleteHub.isPending;

  const confirmDeactivate = async () => {
    if (memberCount > 0) {
      const { isConfirmed } = await Swal.fire({
        title: 'Nonaktifkan hub ini?',
        html: `<p style="color:#991b1b;margin:0 0 8px"><b>${memberCount} anggota</b> akan kehilangan akses lintas-tenant.</p><p style="color:#6b7280;font-size:13px;text-align:left">Hub nonaktif tidak dihitung sebagai tenant yang bisa diakses anggota hub.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Nonaktifkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#6b7280',
      });
      if (!isConfirmed) return false;
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Nama hub wajib diisi.');
    setError('');

    if (isActive !== hub.isActive && !(await confirmDeactivate())) {
      setIsActive(hub.isActive);
      return;
    }

    try {
      await updateHub.mutateAsync({
        hubId: hub.id,
        name: name.trim(),
        description: description.trim(),
        isActive,
      });
      setDirty(false);
      toast({ title: 'Profil hub disimpan', icon: 'success' });
    } catch (err) {
      setError(hubErrorMessage(err, 'Gagal menyimpan hub'));
    }
  };

  const handleDelete = async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'Hapus Hub?',
      html: `<p style="color:#991b1b;margin:0 0 8px"><b>${hub.name}</b> akan dihapus.</p><p style="color:#6b7280;font-size:13px;text-align:left">${
        hub.tenantCount > 0
          ? `Hub ini masih memiliki <b>${hub.tenantCount} tenant</b>. Lepas semua tenant dari hub sebelum menghapus.`
          : 'Akses anggota hub akan ikut terhapus.'
      }</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          await deleteHub.mutateAsync(hub.id);
          return true;
        } catch (err) {
          Swal.showValidationMessage(hubErrorMessage(err, 'Gagal menghapus hub'));
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({ title: 'Hub Dihapus', text: `Hub "${hub.name}" telah dihapus.`, icon: 'success', timer: 2000, showConfirmButton: false });
      onDeleted();
    }
  };

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">{hub.name}</h3>
            <Badge tone={hub.isActive ? 'green' : 'gray'}>{hub.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
          </div>
          <p className="text-xs text-gray-500">
            {hub.tenantCount} tenant · {memberCount} anggota · dibuat {new Date(hub.createdAt).toLocaleDateString('id-ID')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onViewConsolidated(hub.id)} className={smallPillBtnCls}>
            Lihat Konsolidasi
          </button>
          {canManage && (
            <button onClick={handleDelete} disabled={isBusy} className={dangerBtnCls}>
              Hapus Hub
            </button>
          )}
        </div>
      </div>

      {!canManage ? (
        <p className="text-sm text-gray-600 whitespace-pre-line">
          {hub.description || 'Tanpa deskripsi.'}
        </p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Hub *</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              disabled={isBusy}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <input
              className={inputCls}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              disabled={isBusy}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setDirty(true);
              }}
              disabled={isBusy}
            />
            Aktif ({memberCount} anggota punya akses lintas-tenant)
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isBusy || !dirty} className={primaryBtnCls}>
              {updateHub.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            {dirty && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setName(hub.name);
                  setDescription(hub.description ?? '');
                  setIsActive(hub.isActive);
                  setDirty(false);
                  setError('');
                }}
                className={ghostBtnCls}
              >
                Batal
              </button>
            )}
            {!canManage && <span className="text-xs text-gray-400 self-center">Read-only</span>}
          </div>
        </form>
      )}
    </div>
  );
}
