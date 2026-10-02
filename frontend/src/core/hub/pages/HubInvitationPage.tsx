import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAcceptHubInvitation,
  useHubInvitationPreview,
} from '../../../@shared/hooks/useHubInvitations';
import { apiErrorMessage } from '../../platform/components/platformUi';

/**
 * Hub V2 Fase 20 — redeeming an invitation.
 *
 * The audience is an ordinary signed-in user, not a platform admin, so this page
 * deliberately sits outside the Terminal Center chrome and outside the POS
 * dashboard layout. It is also the only page a brand-new member needs to see
 * before they have any cross-tenant access at all.
 *
 * Every failure mode gets its own message instead of one generic error: the
 * server distinguishes "this link is for another address", "it lapsed", "it was
 * revoked" and "you are already a member", and a member told only "gagal" cannot
 * tell whether to ask for a new link or to stop.
 */
export default function HubInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: preview, isLoading, isError } = useHubInvitationPreview(token ?? null);
  const accept = useAcceptHubInvitation();
  const [acceptError, setAcceptError] = useState('');

  const handleAccept = async () => {
    if (!token) return;
    setAcceptError('');
    try {
      await accept.mutateAsync(token);
      navigate('/dashboard');
    } catch (e) {
      setAcceptError(apiErrorMessage(e, 'Gagal menerima undangan'));
    }
  };

  if (isError) {
    return (
      <Shell title="Undangan tidak berlaku">
        <p className="text-sm text-gray-600">
          Tautan undangan tidak ditemukan, sudah dicabut, atau sudah pernah dipakai. Minta tautan baru kepada admin
          hub.
        </p>
        <BackButton />
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell title="Memuat undangan...">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell title="Undangan tidak ditemukan">
        <BackButton />
      </Shell>
    );
  }

  const expired = preview.status === 'expired';
  const revoked = preview.status === 'revoked';
  const accepted = preview.status === 'accepted';
  const blocked = expired || revoked || accepted;
  const expiresAt = new Date(preview.expiresAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Shell title={`Undangan bergabung ke ${preview.hubName}`}>
      <dl className="space-y-2 text-sm">
        <Row label="Hub" value={preview.hubName} />
        <Row label="Email tujuan" value={preview.email} />
        <Row label="Role" value={preview.roleLabel} />
        <Row label="Berlaku sampai" value={expiresAt} />
      </dl>

      {!preview.emailMatches && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          Undangan ini ditujukan untuk <b>{preview.email}</b>, sedangkan akun yang sedang masuk memakai{' '}
          <b>{preview.currentUserEmail ?? 'alamat tanpa email'}</b>. Masuk dengan email yang ada di undangan ini
          untuk menerimanya.{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="underline font-medium"
          >
            Ganti akun
          </button>
        </div>
      )}

      {expired && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
          Undangan ini sudah <b>kedaluwarsa</b>. Minta tautan baru kepada admin hub.
        </div>
      )}
      {revoked && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Undangan ini sudah <b>dicabut</b> oleh admin hub.
        </div>
      )}
      {accepted && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
          Undangan ini sudah pernah diterima. Kalau tenant baru belum muncul di tenant switcher, hubungi admin hub.
        </div>
      )}
      {preview.alreadyMember && !blocked && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Kamu <b>sudah menjadi anggota</b> hub ini. Menerima undangan hanya mengonfirmasi keanggotaan yang sudah ada.
        </div>
      )}

      {acceptError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{acceptError}</div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={handleAccept}
          disabled={blocked || !preview.emailMatches || accept.isPending}
          className={primaryBtnCls}
        >
          {accept.isPending ? 'Memproses...' : accepted ? 'Sudah Diterima' : 'Terima Undangan'}
        </button>
        <BackButton />
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-gray-500">POSMono · Hub</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 text-right">{value}</dd>
    </div>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/dashboard')} className={ghostBtnCls}>
      Kembali ke Dashboard
    </button>
  );
}

const primaryBtnCls =
  'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50';
const ghostBtnCls =
  'px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium';
