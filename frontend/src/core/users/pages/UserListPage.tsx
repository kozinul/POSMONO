import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VOID_ORDER_PERMISSION, VOID_PAYMENT_PERMISSION } from '../../../@shared/utils/permissions';
import { toast } from '../../../@shared/hooks/useToast';
import { useSweetAlert } from '../../../@shared/hooks/useSweetAlert';
import {
  useUsers,
  useRoles,
  useOutlets,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserActive,
  type User,
  type Role,
  type Outlet,
} from '../hooks/useUsers';

const VOID_PERMISSIONS = [VOID_ORDER_PERMISSION, VOID_PAYMENT_PERMISSION];
const ALL_OUTLETS_ROLES = ['owner', 'admin'];

function roleAllowsVoid(role?: Role): boolean {
  return !!role && role.permissions.some((p) => VOID_PERMISSIONS.includes(p));
}

function roleIsAllOutlets(role?: Role): boolean {
  return !!role && ALL_OUTLETS_ROLES.includes(role.name.toLowerCase().trim());
}

function roleIsSingleOutlet(role?: Role): boolean {
  return !!role && role.name.toLowerCase().trim() === 'cashier';
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UserListPage() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    roleId: '',
    password: '',
    pin: '',
    pinConfirm: '',
    clearPin: false,
    outletIds: [] as string[],
  });
  const [formError, setFormError] = useState('');

  const { data: users = [], isLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const { data: outlets = [] } = useOutlets();

  const activeOutlets = outlets.filter((o) => o.isActive);

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const toggleMutation = useToggleUserActive();
  const fireSwal = useSweetAlert();

  const selectedRole = roles.find((r) => r.id === formData.roleId);
  const showPinField = roleAllowsVoid(selectedRole);

  const outletBehavior =
    roleIsAllOutlets(selectedRole) ? 'all'
    : roleIsSingleOutlet(selectedRole) ? 'single'
    : selectedRole ? 'multi'
    : 'none';

  const setSelectedOutlets = (ids: string[]) => {
    setFormData((f) => ({ ...f, outletIds: ids }));
  };

  const resetForm = () => {
    setFormData({
      email: '',
      displayName: '',
      roleId: '',
      password: '',
      pin: '',
      pinConfirm: '',
      clearPin: false,
      outletIds: [],
    });
  };

  const openCreateModal = () => {
    setEditingUser(null);
    resetForm();
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      displayName: user.displayName,
      roleId: user.roleId,
      password: '',
      pin: '',
      pinConfirm: '',
      clearPin: false,
      outletIds: [...(user.outletIds ?? [])],
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormError('');
  };

  const getRoleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name || '-';

  const getOutletNames = (outletIds: string[]) => {
    if (!outletIds || outletIds.length === 0) return 'Semua outlet';
    return outletIds.map((id) => outlets.find((o) => o.id === id)?.name || id).join(', ');
  };

  const handleSubmit = () => {
    setFormError('');
    const isCreate = !editingUser;

    if (isCreate && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      setFormError('Email wajib diisi dengan format valid');
      return;
    }
    if (!formData.displayName.trim()) {
      setFormError('Nama tampilan wajib diisi');
      return;
    }
    if (!formData.roleId) {
      setFormError('Role wajib dipilih');
      return;
    }
    if (isCreate && formData.password.length < 6) {
      setFormError('Password minimal 6 karakter');
      return;
    }

    let outgoingOutletIds: string[] = [];
    if (outletBehavior === 'all') {
      outgoingOutletIds = [];
    } else if (outletBehavior === 'single' && formData.outletIds.length !== 1) {
      setFormError('Role kasir harus tepat memiliki 1 outlet');
      return;
    } else if (outletBehavior === 'multi' && formData.outletIds.length === 0) {
      setFormError('Pilih minimal 1 outlet untuk role ini');
      return;
    } else {
      outgoingOutletIds = formData.outletIds;
    }

    let pin: string | null | undefined;
    if (showPinField) {
      if (formData.clearPin) {
        pin = null;
      } else if (formData.pin || formData.pinConfirm) {
        if (!/^\d{4,6}$/.test(formData.pin)) {
          setFormError('PIN harus 4-6 digit angka');
          return;
        }
        if (formData.pin !== formData.pinConfirm) {
          setFormError('Konfirmasi PIN tidak sama');
          return;
        }
        pin = formData.pin;
      }
    }

    if (isCreate) {
      createMutation.mutate(
        {
          email: formData.email.trim(),
          displayName: formData.displayName.trim(),
          roleId: formData.roleId,
          password: formData.password,
          pin,
          outletIds: outletBehavior === 'none' ? undefined : outgoingOutletIds,
        },
        {
          onSuccess: () => {
            toast({ title: 'Pengguna berhasil ditambahkan' });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeModal();
          },
          onError: () => {
            toast({ title: 'Gagal menambahkan pengguna', icon: 'error' });
          },
        },
      );
      return;
    }

    const payload: Record<string, unknown> = {
      displayName: formData.displayName.trim(),
      roleId: formData.roleId,
      outletIds: outletBehavior === 'none' ? undefined : outgoingOutletIds,
    };
    if (formData.password) {
      payload.password = formData.password;
    }
    if (pin !== undefined) {
      payload.pin = pin;
    }

    updateMutation.mutate(
      { id: editingUser.id, ...payload },
      {
        onSuccess: () => {
          toast({ title: 'Pengguna berhasil diperbarui' });
          queryClient.invalidateQueries({ queryKey: ['users'] });
          closeModal();
        },
        onError: () => {
          toast({ title: 'Gagal memperbarui pengguna', icon: 'error' });
        },
      },
    );
  };

  const handleDelete = (user: User) => {
    fireSwal({
      title: 'Hapus user?',
      text: `User "${user.displayName}" akan dihapus permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    }).then((result) => {
      if (!result.isConfirmed) return;
      deleteMutation.mutate(user.id, {
        onSuccess: () => {
          toast({ title: 'Pengguna berhasil dihapus' });
        },
        onError: () => {
          toast({ title: 'Gagal menghapus pengguna', icon: 'error' });
        },
      });
    });
  };

  const handleToggleActive = (user: User) => {
    toggleMutation.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => {
          toast({ title: user.isActive ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan' });
        },
        onError: () => {
          toast({ title: 'Gagal mengubah status pengguna', icon: 'error' });
        },
      },
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button
          onClick={openCreateModal}
          className="blue-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90"
        >
          + Tambah User
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outlet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Login</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">Memuat data...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">Tidak ada user</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.displayName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getRoleName(user.roleId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-block max-w-[160px] truncate align-bottom" title={getOutletNames(user.outletIds)}>
                      {getOutletNames(user.outletIds)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.lastLoginAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openEditModal(user)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button onClick={() => handleToggleActive(user)} className="text-amber-600 hover:text-amber-900 mr-3">
                      {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onClick={() => handleDelete(user)} className="text-red-600 hover:text-red-900">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editingUser ? 'Edit User' : 'Tambah User'}</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  disabled={!!editingUser}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <div>
                <label htmlFor="user-display-name" className="block text-sm font-medium text-gray-700 mb-1">Nama Tampilan</label>
                <input
                  id="user-display-name"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  id="user-role"
                  aria-label="Role"
                  value={formData.roleId}
                  onChange={(e) => {
                    setFormData({ ...formData, roleId: e.target.value, outletIds: [], pin: '', pinConfirm: '', clearPin: false });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Pilih Role --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Outlet</label>
                {outletBehavior === 'all' ? (
                  <p className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Role <span className="font-semibold">{selectedRole?.name}</span> mencakup <b>semua outlet</b> tenant ini.
                  </p>
                ) : outletBehavior === 'single' ? (
                  <div>
                    <select
                      aria-label="Outlet"
                      value={formData.outletIds[0] ?? ''}
                      onChange={(e) => setSelectedOutlets(e.target.value ? [e.target.value] : [])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Pilih Outlet --</option>
                      {activeOutlets.map((outlet) => (
                        <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Kasir hanya bertransaksi di satu outlet.</p>
                  </div>
                ) : outletBehavior === 'multi' ? (
                  <div>
                    <div className="space-y-2 border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {activeOutlets.length === 0 && <p className="text-xs text-gray-500">Belum ada outlet aktif.</p>}
                      {activeOutlets.map((outlet) => {
                        const checked = formData.outletIds.includes(outlet.id);
                        return (
                          <label key={outlet.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedOutlets(
                                  e.target.checked
                                    ? [...formData.outletIds, outlet.id]
                                    : formData.outletIds.filter((id) => id !== outlet.id),
                                )
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">{outlet.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Pilih 1 atau lebih outlet yang boleh diakses.</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Pilih role terlebih dahulu untuk mengatur outlet.</p>
                )}
              </div>
              <div>
                <label htmlFor="user-password" className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'Password Baru' : 'Password'}
                </label>
                <input
                  id="user-password"
                  type="password"
                  placeholder={editingUser ? 'Kosongkan jika tidak diganti' : 'Minimal 6 karakter'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {showPinField ? (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label htmlFor="user-pin" className="block text-sm font-medium text-gray-700 mb-1">PIN Manager</label>
                    <input
                      id="user-pin"
                      type="password"
                      inputMode="numeric"
                      placeholder="4-6 digit"
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      PIN dipakai untuk persetujuan void oleh kasir di terminal POS.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="user-pin-confirm" className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi PIN</label>
                    <input
                      id="user-pin-confirm"
                      type="password"
                      inputMode="numeric"
                      placeholder="Ulangi PIN"
                      value={formData.pinConfirm}
                      onChange={(e) => setFormData({ ...formData, pinConfirm: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {editingUser && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.clearPin}
                        onChange={(e) => setFormData({ ...formData, clearPin: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">Hapus PIN (wajib PIN saat void)</label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500">
                    Role ini tidak memiliki permission <code className="text-gray-700">order:void</code> /
                    <code className="text-gray-700">payment:void</code> — PIN tidak diperlukan untuk user ini.
                  </p>
                </div>
              )}

              {formError && <div className="text-sm text-red-600">{formError}</div>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={updateMutation.isPending || createMutation.isPending}
                className="px-4 py-2 blue-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending || createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
