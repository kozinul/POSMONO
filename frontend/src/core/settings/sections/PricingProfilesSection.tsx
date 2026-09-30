import { useState } from 'react';
import Swal from 'sweetalert2';
import { usePricingProfiles, useCreatePricingProfile, useUpdatePricingProfile, useDeletePricingProfile } from '../../../@shared/hooks/usePricingProfile';
import type { ITaxRule } from '../../../@shared/hooks/useTaxConfiguration';

export interface PricingProfilesSectionProps {
  activeRules: ITaxRule[];
}

export default function PricingProfilesSection({ activeRules }: PricingProfilesSectionProps) {
  const { data: pricingProfiles, isLoading: profilesLoading } = usePricingProfiles();
  const createProfile = useCreatePricingProfile();
  const updatePricingProfile = useUpdatePricingProfile();
  const deletePricingProfile = useDeletePricingProfile();
  const [profileForm, setProfileForm] = useState<{ name: string; description: string; taxRuleIds: string[]; isDefault: boolean } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Profil Harga</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Kelompok aturan pajak untuk produk dengan kategori harga berbeda</p>
                  </div>
                  <button
                    onClick={() => setProfileForm({ name: '', description: '', taxRuleIds: [], isDefault: false })}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    + Profil Baru
                  </button>
                </div>

                {profileForm && (
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{profileForm.name || 'Profil Baru'}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nama Profil</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Food & Beverage"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
                        <input
                          type="text"
                          value={profileForm.description}
                          onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Produk makanan dan minuman"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-2">Aturan Pajak</label>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                        {activeRules.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Belum ada aturan pajak. Buat di tab Aturan Pajak.</p>
                        ) : (
                          activeRules.map((rule) => (
                            <label key={rule.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={profileForm.taxRuleIds.includes(rule.id)}
                                onChange={(e) => {
                                  setProfileForm({
                                    ...profileForm,
                                    taxRuleIds: e.target.checked
                                      ? [...profileForm.taxRuleIds, rule.id]
                                      : profileForm.taxRuleIds.filter((id) => id !== rule.id),
                                  });
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{rule.name} ({rule.policy.value}%)</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="profile-default"
                        checked={profileForm.isDefault}
                        onChange={(e) => setProfileForm({ ...profileForm, isDefault: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="profile-default" className="text-sm text-gray-700">Jadikan default</label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={profileSaving || !profileForm.name.trim()}
                        onClick={async () => {
                          setProfileSaving(true);
                          try {
                            await createProfile.mutateAsync(profileForm);
                            setProfileForm(null);
                          } finally {
                            setProfileSaving(false);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {profileSaving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button
                        onClick={() => setProfileForm(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {profilesLoading ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">Memuat...</div>
                  ) : !pricingProfiles || pricingProfiles.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">Belum ada profil harga. Klik "+ Profil Baru" untuk membuat.</div>
                  ) : (
                    pricingProfiles.map((profile) => (
                      <div key={profile.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{profile.name}</span>
                            {profile.isDefault && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Default</span>
                            )}
                            {!profile.active && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Nonaktif</span>
                            )}
                          </div>
                          {profile.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{profile.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{profile.taxRuleIds.length} aturan pajak</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await updatePricingProfile.mutateAsync({ id: profile.id, active: !profile.active });
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                          >
                            {profile.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: 'Hapus profil?',
                                text: `Profil "${profile.name}" akan dihapus.`,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#dc2626',
                                cancelButtonColor: '#6b7280',
                                confirmButtonText: 'Ya, hapus',
                                cancelButtonText: 'Batal',
                              });
                              if (!result.isConfirmed) return;
                              await deletePricingProfile.mutateAsync(profile.id);
                              Swal.fire({
                                title: 'Berhasil dihapus',
                                icon: 'success',
                                timer: 1500,
                                showConfirmButton: false,
                              });
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
  );
}
