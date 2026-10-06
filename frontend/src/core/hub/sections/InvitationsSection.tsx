import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  Badge,
  EmptyState,
  ErrorNote,
  cardCls,
  dangerBtnCls,
  inputCls,
  primaryBtnCls,
} from '../../platform/components/platformUi';
import { type HubMemberRole } from '../../../@shared/hooks/useHubMemberships';
import { assignableHubRoles, HUB_ROLE_LABELS as HUB_MEMBER_ROLE_LABELS, HUB_ROLE_HINTS as HUB_MEMBER_ROLE_HINTS } from '../utils/roles';
import {
  useCreateHubInvitation,
  useMyHubInvitations,
  useRevokeHubInvitation,
} from '../../../@shared/hooks/useMyHub';

/** Single-use mailbox for handing the raw link out. */
function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (no permission, insecure context). Select the
      // text instead — copying by hand still works, a silently dead button does not.
      const field = document.getElementById('hub-invitation-link');
      if (field instanceof HTMLInputElement) {
        field.select();
        setCopied(false);
      }
    }
  };

  return (
    <div className="flex gap-2">
      <input
        id="hub-invitation-link"
        readOnly
        className={`${inputCls} font-mono text-xs`}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button className={primaryBtnCls} onClick={copy}>
        {copied ? 'Tersalin' : 'Salin'}
      </button>
    </div>
  );
}

/**
 * Fase 24 — inviting people who are not in a hub tenant yet.
 *
 * The token is shown exactly once, here, and never again: the backend stores only
 * its hash, so this panel is the sole opportunity to pass the link on. Hence the
 * persistent banner rather than a toast.
 */
export default function InvitationsSection({
  hubId,
  hubCode,
  actorRole,
  canManage,
}: {
  hubId: string;
  hubCode: string | null;
  actorRole: string;
  canManage: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<HubMemberRole>('viewer');
  const [hours, setHours] = useState('168');
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const invitations = useMyHubInvitations(canManage ? hubId : null);
  const createInvitation = useCreateHubInvitation();
  const revokeInvitation = useRevokeHubInvitation();

  const assignable = assignableHubRoles(actorRole);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHours = Number(hours);
    try {
      const res = await createInvitation.mutateAsync({
        hubId,
        email: email.trim(),
        role,
        expiresInHours: Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : undefined,
      });
      const payload = (res.data as { data?: { token?: string } })?.data ?? {};
      const token = payload.token ?? '';
      setIssuedLink(token ? `${window.location.origin}/hub-invitations/${token}` : null);
      setEmail('');
      await Swal.fire({
        icon: 'success',
        title: 'Undangan dibuat',
        text: 'Salin tautan di bawah dan kirimkan ke penerima. Tautan hanya ditampilkan sekali.',
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal membuat undangan',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    }
  };

  const revoke = async (id: string, invitee: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: `Cabut undangan untuk ${invitee}?`,
      text: 'Tautan yang sudah dibagikan tidak akan bisa dipakai lagi.',
      showCancelButton: true,
      confirmButtonText: 'Cabut',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      await revokeInvitation.mutateAsync({ hubId, invitationId: id });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal mencabut undangan',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {issuedLink && (
        <div className={cardCls}>
          <h3 className="text-sm font-bold text-gray-900">Tautan undangan</h3>
          <p className="mt-1 text-xs text-amber-700">
            Disimpan atau kirimkan sekarang — tautan ini tidak akan ditampilkan lagi.
          </p>
          <div className="mt-3">
            <CopyField value={issuedLink} />
          </div>
          <button className="mt-3 text-xs text-gray-500 hover:text-gray-700" onClick={() => setIssuedLink(null)}>
            Sembunyikan
          </button>
        </div>
      )}

      {canManage && (
        <form onSubmit={submit} className={cardCls}>
          <h3 className="text-sm font-bold text-gray-900">Undang anggota baru</h3>
          <p className="mt-1 text-xs text-gray-600">
            Untuk orang dari dalam tenant hub, lebih cepat menambahkannya langsung dari tab Anggota.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label htmlFor="hub-invite-email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="hub-invite-email"
                type="email"
                required
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
              />
            </div>
            <div>
              <label htmlFor="hub-invite-role" className="mb-1 block text-sm font-medium text-gray-700">
                Role hub
              </label>
              <select
                id="hub-invite-role"
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value as HubMemberRole)}
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {HUB_MEMBER_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hub-invite-hours" className="mb-1 block text-sm font-medium text-gray-700">
                Berlaku (jam)
              </label>
              <input
                id="hub-invite-hours"
                type="number"
                min={1}
                max={720}
                className={inputCls}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">{HUB_MEMBER_ROLE_HINTS[role]}</p>
          <button type="submit" className={`${primaryBtnCls} mt-4`} disabled={createInvitation.isPending}>
            {createInvitation.isPending ? 'Membuat...' : 'Buat undangan'}
          </button>
        </form>
      )}

      {canManage && (
        <div className={cardCls}>
          <h3 className="mb-3 text-sm font-bold text-gray-900">Undangan terbuka</h3>
          {invitations.isLoading && <div className="text-sm text-gray-500">Memuat undangan...</div>}
          {invitations.error && <ErrorNote>{invitations.error instanceof Error ? invitations.error.message : 'Gagal memuat undangan.'}</ErrorNote>}
          {invitations.data?.length === 0 && <EmptyState>Belum ada undangan terbuka.</EmptyState>}
          {!!invitations.data?.length && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Berlaku sampai</th>
                    <th className="px-4 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invitations.data.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.email}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.roleLabel || HUB_MEMBER_ROLE_LABELS[inv.role as HubMemberRole] || inv.role}</td>
                      <td className="px-4 py-3">
                        {inv.status === 'pending' ? (
                          <Badge tone="blue">Menunggu</Badge>
                        ) : inv.status === 'accepted' ? (
                          <Badge tone="green">Diterima</Badge>
                        ) : inv.status === 'expired' ? (
                          <Badge tone="gray">Kedaluwarsa</Badge>
                        ) : (
                          <Badge tone="red">Dicabut</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(inv.expiresAt).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.status === 'pending' && (
                          <button
                            className={dangerBtnCls}
                            disabled={revokeInvitation.isPending}
                            onClick={() => revoke(inv.id, inv.email)}
                          >
                            Cabut
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hubCode && (
            <p className="mt-3 text-xs text-gray-500">
              Kode hub: <code className="font-mono">{hubCode}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
