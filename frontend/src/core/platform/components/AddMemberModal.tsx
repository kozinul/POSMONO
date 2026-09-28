import { useEffect, useState } from 'react';
import {
  HUB_MEMBER_ROLES,
  HUB_MEMBER_ROLE_HINTS,
  HUB_MEMBER_ROLE_LABELS,
  type HubMemberRole,
} from '../../../@shared/hooks/useHubMemberships';
import { useAddHubMembership } from '../../../@shared/hooks/useHubMemberships';
import { usePlatformUsers } from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  Badge,
  EmptyState,
  ErrorNote,
  Loading,
  Modal,
  apiErrorMessage,
  inputCls,
  primaryBtnCls,
} from './platformUi';

function memberErrorMessage(e: unknown): string {
  const msg = apiErrorMessage(e, 'Gagal menambah anggota');
  if (/already a member/i.test(msg)) return 'User ini sudah menjadi anggota hub.';
  return msg;
}

export default function AddMemberModal({
  isOpen,
  hubId,
  hubName,
  onClose,
}: {
  isOpen: boolean;
  hubId: string;
  hubName: string;
  onClose: () => void;
}) {
  const addMember = useAddHubMembership();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<HubMemberRole>('admin');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data: usersData, isLoading, isFetching } = usePlatformUsers(
    { search: debounced || undefined, hubId, isActive: true, page: 1, limit: 20 },
    { enabled: isOpen },
  );

  if (!isOpen) return null;

  const users = usersData?.data ?? [];
  const total = usersData?.total ?? 0;
  const isBusy = addMember.isPending;
  const isTruncated = total > users.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return setError('Pilih user yang akan dijadikan anggota.');
    setError('');
    try {
      await addMember.mutateAsync({ hubId, userId, role });
      toast({ title: 'Anggota ditambahkan ke hub', icon: 'success' });
      setUserId('');
      setTerm('');
      setDebounced('');
      onClose();
    } catch (err) {
      setError(memberErrorMessage(err));
    }
  };

  return (
    <Modal
      title={`Tambah Anggota ${hubName}`}
      onClose={() => (isBusy ? undefined : onClose())}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={isBusy} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50">
            Batal
          </button>
          <button type="submit" form="add-member-form" disabled={isBusy} className={primaryBtnCls}>
            {isBusy ? 'Menambah...' : 'Tambah Anggota'}
          </button>
        </>
      }
    >
      <form id="add-member-form" onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        <div>
          <label htmlFor="hub-member-search" className="block text-sm font-medium text-gray-700 mb-1">
            Cari user (nama, email, atau ID)
          </label>
          <input
            id="hub-member-search"
            className={inputCls}
            placeholder="Cari user lintas tenant..."
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setError('');
            }}
            disabled={isBusy}
          />
          <p className="text-xs text-gray-500 mt-1">
            User aktif dari seluruh tenant. Ketik minimal sebagian nama atau email bila hasil terlalu banyak.
          </p>
        </div>

        <div>
          {isLoading ? (
            <Loading />
          ) : users.length === 0 ? (
            <EmptyState>
              {debounced ? `User "${debounced}" tidak ditemukan.` : 'Belum ada user yang bisa ditambahkan ke hub ini.'}
            </EmptyState>
          ) : (
            <div className="border rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto" aria-label="Daftar kandidat anggota">
              {users.map((u) => {
                const alreadyMember = u.isHubMember;
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm ${alreadyMember ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50 cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="hub-member-user"
                      value={u.id}
                      checked={userId === u.id}
                      disabled={alreadyMember || isBusy}
                      onChange={() => {
                        setUserId(u.id);
                        setError('');
                      }}
                    />
                    <span className="font-medium text-gray-900">{u.displayName || u.email}</span>
                    <span className="text-xs text-gray-500">{u.email}</span>
                    {u.roleName && <Badge tone="blue">{u.roleName}</Badge>}
                    {u.tenantName && <Badge tone="gray">{u.tenantName}</Badge>}
                    {!u.isActive && <Badge tone="amber">Nonaktif</Badge>}
                    {alreadyMember && <Badge tone="gray">Sudah anggota</Badge>}
                  </label>
                );
              })}
            </div>
          )}
          {isTruncated && (
            <p className="text-xs text-gray-500 mt-1">
              Menampilkan 20 dari {total} user yang cocok. Persempit pencarian bila user yang dicari belum muncul.
            </p>
          )}
          {!isLoading && !isTruncated && isFetching && <p className="text-xs text-gray-500 mt-1">Memuat…</p>}
        </div>

        <div>
          <label htmlFor="hub-member-role" className="block text-sm font-medium text-gray-700 mb-1">
            Role akses lintas-tenant
          </label>
          <select
            id="hub-member-role"
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value as HubMemberRole)}
            disabled={isBusy}
          >
            {HUB_MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {HUB_MEMBER_ROLE_LABELS[r]} — {HUB_MEMBER_ROLE_HINTS[r]}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Anggota dapat berpindah ke tenant milik hub ini lewat tenant switcher setelah masuk.
          </p>
        </div>
      </form>
    </Modal>
  );
}
