import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  usePlatformDeleteHub,
  usePlatformUpdateHub,
  HUB_STATUS_LABELS,
  HUB_STATUS_OPTIONS,
  type HubStatus,
  type PlatformHubDetail,
} from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  ArchivedNotice,
  HubStatusBadge,
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
  if (/name already exists/i.test(msg)) return 'Nama hub sudah dipakai.';
  if (/code already exists/i.test(msg)) return 'Kode hub sudah dipakai hub lain.';
  if (/assigned tenants/i.test(msg)) return 'Lepas semua tenant dari hub sebelum menghapus.';
  return msg;
}

export default function HubProfileCard({
  hub,
  memberCount,
  ownerName,
  canManage,
  onDeleted,
  onViewConsolidated,
}: {
  hub: PlatformHubDetail;
  memberCount: number;
  /** `ownerUserId` when set, else the first member holding the hub `owner` role. */
  ownerName: string | null;
  canManage: boolean;
  onDeleted: () => void;
  onViewConsolidated: (hubId: string) => void;
}) {
  const updateHub = usePlatformUpdateHub();
  const deleteHub = usePlatformDeleteHub();
  const [name, setName] = useState(hub.name);
  const [description, setDescription] = useState(hub.description ?? '');
  const [code, setCode] = useState(hub.code);
  const [status, setStatus] = useState<HubStatus>(hub.status);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(hub.name);
    setDescription(hub.description ?? '');
    setCode(hub.code);
    setStatus(hub.status);
    setDirty(false);
    setError('');
  }, [hub.id, hub.name, hub.description, hub.code, hub.status, hub.updatedAt]);

  const isBusy = updateHub.isPending || deleteHub.isPending;
  const isArchived = hub.status === 'archived';

  /**
   * Losing members' cross-tenant access and locking a tombstone are different
   * consequences, so they get different warnings. Re-opening an archived hub is
   * the cheap fix, so it deliberately asks for no confirmation.
   */
  const confirmStatusChange = async (next: HubStatus): Promise<boolean> => {
    if (next === hub.status) return true;

    if (next === 'archived') {
      const { isConfirmed } = await Swal.fire({
        title: 'Arsipkan hub ini?',
        html: `<p style="color:#991b1b;margin:0 0 8px"><b>${hub.name}</b> akan menjadi read-only.</p><p style="color:#6b7280;font-size:13px;text-align:left">Profil, tenant (<b>${hub.tenantCount}</b>), anggota (<b>${memberCount}</b>), dan aturan akses akan terkunci. <b>${memberCount} anggota</b> langsung kehilangan akses lintas-tenant.<br><br>Kembalikan status ke Aktif atau Ditangguhkan kapan saja untuk membuka lagi.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Arsipkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#6b7280',
        cancelButtonColor: '#6b7280',
      });
      return isConfirmed;
    }

    // Active -> suspended is the "pause access" lever; anything re-opening an
    // archived hub is a restore, not a revocation.
    if (hub.status === 'active' && next === 'suspended') {
      const { isConfirmed } = await Swal.fire({
        title: 'Tangguhkan hub ini?',
        html: `<p style="color:#92400e;margin:0 0 8px"><b>${memberCount} anggota</b> akan kehilangan akses lintas-tenant.</p><p style="color:#6b7280;font-size:13px;text-align:left">Tenant dan aturan akses tetap utuh — statusnya hanya dinonaktifkan sementara, jadi menganggihkan akses ini gampang dibalik.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Tangguhkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#6b7280',
      });
      return isConfirmed;
    }

    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Nama hub wajib diisi.');
    if (!code.trim()) return setError('Kode hub wajib diisi.');
    setError('');

    if (!(await confirmStatusChange(status))) {
      setStatus(hub.status);
      return;
    }

    try {
      // `status`, not `isActive` — the API ignores the derived mirror, so
      // sending it produced a success toast with nothing actually changed.
      await updateHub.mutateAsync({
        hubId: hub.id,
        name: name.trim(),
        description: description.trim(),
        code: code.trim(),
        status,
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
          : isArchived
            ? 'Hub diarsipkan. Akses anggota sudah tidak aktif, jadi penghapusan tidak memutus sesi siapa pun.'
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
            <HubStatusBadge status={hub.status} />
          </div>
          <p className="font-mono text-xs text-gray-500 mt-0.5">{hub.code}</p>
          <p className="text-xs text-gray-500">
            {hub.tenantCount} tenant · {memberCount} anggota · dibuat {new Date(hub.createdAt).toLocaleDateString('id-ID')}
          </p>
          <p className="text-xs text-gray-500">
            Pemilik Hub: <span className="text-gray-700 font-medium">{ownerName ?? '—'}</span>
            <span className="text-gray-400"> (display)</span>
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

      {isArchived && <ArchivedNotice />}

      {!canManage ? (
        <p className="text-sm text-gray-600 whitespace-pre-line">
          {hub.description || 'Tanpa deskripsi.'}
        </p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          <div>
            <label htmlFor="hub-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nama Hub *
            </label>
            <input
              id="hub-name"
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              disabled={isBusy || isArchived}
            />
          </div>
          <div>
            <label htmlFor="hub-code" className="block text-sm font-medium text-gray-700 mb-1">
              Kode Hub *
            </label>
            <input
              id="hub-code"
              className={inputCls + ' font-mono'}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setDirty(true);
              }}
              placeholder="KOPI-NUSANTARA"
              disabled={isBusy || isArchived}
            />
            <p className="text-xs text-gray-400 mt-1">
              Huruf besar, angka, dan tanda hubung. Maksimal 24 karakter. Dibuat otomatis dari nama saat hub pertama
              dibuat.
            </p>
          </div>
          <div>
            <label htmlFor="hub-description" className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi
            </label>
            <input
              id="hub-description"
              className={inputCls}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              disabled={isBusy || isArchived}
            />
          </div>
          <div>
            <label htmlFor="hub-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="hub-status"
              className={inputCls}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as HubStatus);
                setDirty(true);
              }}
              disabled={isBusy}
            >
              {HUB_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {HUB_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {status === 'archived'
                ? 'Read-only: hanya status ini yang bisa diubah sampai hub diaktifkan kembali.'
                : status === 'suspended'
                  ? 'Anggota kehilangan akses lintas-tenant, tenant & aturan akses tetap utuh.'
                  : `${memberCount} anggota punya akses lintas-tenant.`}
            </p>
          </div>
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
                  setCode(hub.code);
                  setStatus(hub.status);
                  setDirty(false);
                  setError('');
                }}
                className={ghostBtnCls}
              >
                Batal
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
