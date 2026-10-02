import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  HUB_MEMBER_ROLES,
  HUB_MEMBER_ROLE_HINTS,
  HUB_MEMBER_ROLE_LABELS,
  type HubMemberRole,
} from '../../../@shared/hooks/useHubMemberships';
import {
  HUB_INVITATION_STATUS_LABELS,
  useCreateHubInvitation,
  useHubInvitations,
  useRevokeHubInvitation,
  type HubInvitation,
  type HubInvitationStatus,
} from '../../../@shared/hooks/useHubInvitations';
import { toast } from '../../../@shared/hooks/useToast';
import {
  Badge,
  EmptyState,
  ErrorNote,
  Loading,
  apiErrorMessage,
  cardCls,
  dangerBtnCls,
  inputCls,
  primaryBtnCls,
  smallPillBtnCls,
  subtleBtnCls,
} from './platformUi';
import { ArchivedNotice } from './platformUi';
import type { HubStatus } from '../../../@shared/hooks/usePlatform';

const STATUS_TONE: Record<HubInvitationStatus, 'amber' | 'green' | 'gray' | 'red'> = {
  pending: 'amber',
  accepted: 'green',
  expired: 'gray',
  revoked: 'red',
};

/** Offered lifetimes, mirroring the server's clamp of 1 hour … 30 days. */
const EXPIRY_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: '1 hari' },
  { value: 24 * 3, label: '3 hari' },
  { value: 24 * 7, label: '7 hari (bawaan)' },
  { value: 24 * 14, label: '14 hari' },
  { value: 24 * 30, label: '30 hari' },
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The URL the invitee opens. Same-origin absolute link, built from the browser. */
function invitationLink(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/hub-invitations/${token}`;
}

export default function HubInvitationPanel({
  hubId,
  hubName,
  hubStatus,
  canManage,
  onViewAudit,
}: {
  hubId: string;
  hubName: string;
  hubStatus: HubStatus;
  canManage: boolean;
  onViewAudit?: (action: string) => void;
}) {
  // Only queried while this sub-tab is mounted, like the overview panel.
  const { data: invitations = [], isLoading } = useHubInvitations(hubId);
  const createInvitation = useCreateHubInvitation();
  const revokeInvitation = useRevokeHubInvitation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<HubMemberRole>('viewer');
  const [expiresInHours, setExpiresInHours] = useState<number>(24 * 7);
  const [error, setError] = useState('');
  /**
   * The raw token exists only in the create response. It is deliberately state
   * and not cache: nothing can re-read it, and the panel makes that visible by
   * offering it exactly once.
   */
  const [issued, setIssued] = useState<{ token: string; email: string } | null>(null);

  const locked = hubStatus === 'archived';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Email tujuan wajib diisi.');
    setError('');
    try {
      const res = await createInvitation.mutateAsync({
        hubId,
        email: email.trim(),
        role,
        expiresInHours,
      });
      const token = res.data.data.token;
      setIssued({ token, email: res.data.data.invitation.email });
      setEmail('');
      toast({ title: 'Undangan dibuat — salin tautannya sekarang', icon: 'success' });
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal membuat undangan'));
    }
  };

  const handleCopy = async (token: string) => {
    const link = invitationLink(token);
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Tautan undangan disalin', icon: 'success' });
    } catch {
      // Clipboard access is denied in some browsers and in non-secure contexts;
      // the field stays selectable so the admin can copy it by hand.
      Swal.fire({
        title: 'Salin tautan secara manual',
        html: `<input id="invite-link" readonly value="${link}" style="width:100%;padding:8px;font-size:13px" />`,
        showConfirmButton: false,
        didOpen: () => {
          const field = document.getElementById('invite-link') as HTMLInputElement | null;
          field?.select();
        },
      });
    }
  };

  const handleRevoke = async (invitation: HubInvitation) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Cabut undangan?',
      html: `<p style="color:#1f2937;margin:0 0 8px">Tautan untuk <b>${invitation.email}</b> langsung tidak berlaku.</p><p style="color:#6b7280;font-size:13px;text-align:left">Undangan lain untuk email yang sama tetap bisa dibuat setelah ini.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Cabut',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          await revokeInvitation.mutateAsync({ hubId, invitationId: invitation.id });
          return true;
        } catch (e) {
          Swal.showValidationMessage(apiErrorMessage(e, 'Gagal mencabut undangan'));
          return false;
        }
      },
    });
    if (isConfirmed) {
      toast({ title: 'Undangan dicabut', icon: 'success' });
    }
  };

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Undangan ({invitations.length})
        </h3>
        {onViewAudit && (
          <button onClick={() => onViewAudit('INVITATION_SENT')} className={subtleBtnCls}>
            Lihat di Audit
          </button>
        )}
      </div>

      {locked && (
        <ArchivedNotice>Undangan dibekukan. Kembalikan status hub untuk mengirim atau mencabut undangan.</ArchivedNotice>
      )}

      <p className="text-xs text-gray-500">
        Undangan dipakai untuk orang yang <b>belum punya akun</b>. Untuk user yang sudah terdaftar di salah satu tenant
        hub ini, pakai <b>Tambah Anggota</b> di tab Anggota — di sana akses per-tenant bisa langsung dibatasi.
      </p>

      {canManage && !locked && (
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <label htmlFor="invite-email" className="block text-xs font-medium text-gray-600 mb-1">
                Email tujuan
              </label>
              <input
                id="invite-email"
                type="email"
                className={inputCls}
                placeholder="nama@toko.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={createInvitation.isPending}
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-xs font-medium text-gray-600 mb-1">
                Role hub
              </label>
              <select
                id="invite-role"
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value as HubMemberRole)}
                disabled={createInvitation.isPending}
              >
                {HUB_MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {HUB_MEMBER_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="invite-expiry" className="block text-xs font-medium text-gray-600 mb-1">
                Berlaku
              </label>
              <select
                id="invite-expiry"
                className={inputCls}
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                disabled={createInvitation.isPending}
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">{HUB_MEMBER_ROLE_HINTS[role]}</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex justify-end">
            <button type="submit" className={primaryBtnCls} disabled={createInvitation.isPending}>
              {createInvitation.isPending ? 'Membuat...' : 'Buat Undangan'}
            </button>
          </div>
        </form>
      )}

      {issued && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
          <p className="text-sm text-emerald-900">
            <b>Undangan untuk {issued.email} sudah dibuat.</b> Tautan berikut hanya ditampilkan sekali — kalau hilang,
            cabut undangan ini dan buat yang baru.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-[240px] px-2 py-1 bg-white border border-emerald-200 rounded text-xs break-all">
              {invitationLink(issued.token)}
            </code>
            <button type="button" onClick={() => handleCopy(issued.token)} className={smallPillBtnCls}>
              Salin Tautan
            </button>
            <button type="button" onClick={() => setIssued(null)} className={subtleBtnCls}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : invitations.length === 0 ? (
        <EmptyState>Belum ada undangan untuk hub ini.</EmptyState>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Berlaku Sampai</th>
                {canManage && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-900">{invitation.email}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{invitation.roleLabel}</td>
                  <td className="px-3 py-2 text-sm">
                    <Badge tone={STATUS_TONE[invitation.status]}>
                      {HUB_INVITATION_STATUS_LABELS[invitation.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{formatDateTime(invitation.expiresAt)}</td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      {invitation.status === 'pending' ? (
                        <button
                          onClick={() => handleRevoke(invitation)}
                          disabled={revokeInvitation.isPending || locked}
                          className={dangerBtnCls}
                        >
                          Cabut
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
            {pendingCount} undangan menunggu dijawab
            {hubStatus === 'archived' ? ' · hub diarsipkan, semua perubahan dibekukan' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
