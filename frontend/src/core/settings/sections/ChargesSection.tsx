import { useState } from 'react';
import { useAddCharge, useUpdateCharge, useDeleteCharge } from '../../../@shared/hooks/useTaxConfiguration';
import type { IChargeConfig } from '../../../@shared/hooks/useTaxConfiguration';

export interface ChargesSectionProps {
  taxLoading: boolean;
  activeCharges: IChargeConfig[];
}

export default function ChargesSection({ taxLoading, activeCharges }: ChargesSectionProps) {
  const addCharge = useAddCharge();
  const updateCharge = useUpdateCharge();
  const deleteCharge = useDeleteCharge();

  const [addingCharge, setAddingCharge] = useState(false);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeType, setNewChargeType] = useState<'rate' | 'flat'>('rate');
  const [newChargeRate, setNewChargeRate] = useState(0);
  const [newChargeAmount, setNewChargeAmount] = useState(0);
  const [newChargeIncludeInTaxBase, setNewChargeIncludeInTaxBase] = useState(true);

  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeName, setEditChargeName] = useState('');
  const [editChargeType, setEditChargeType] = useState<'rate' | 'flat'>('rate');
  const [editChargeRate, setEditChargeRate] = useState(0);
  const [editChargeAmount, setEditChargeAmount] = useState(0);
  const [editChargeIncludeInTaxBase, setEditChargeIncludeInTaxBase] = useState(true);

  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Biaya Tambahan</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Kelola biaya service charge, delivery fee, dan biaya lainnya</p>
                </div>

                {/* Active Charges List */}
                <div className="px-6 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Biaya Aktif</h3>
                  {taxLoading ? (
                    <div className="text-sm text-gray-400">Memuat...</div>
                  ) : activeCharges.length === 0 ? (
                    <div className="text-sm text-gray-400">Belum ada biaya tambahan. Tambahkan biaya baru.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeCharges.map((charge) => (
                        <div key={charge.id}>
                          {editingChargeId === charge.id ? (
                            /* Edit Form */
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Nama Biaya</label>
                                  <input
                                    value={editChargeName}
                                    onChange={(e) => setEditChargeName(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                                  <select
                                    value={editChargeType}
                                    onChange={(e) => setEditChargeType(e.target.value as 'rate' | 'flat')}
                                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="rate">Persen (%)</option>
                                    <option value="flat">Nominal (Rp)</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {editChargeType === 'rate' ? (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarif (%)</label>
                                    <input
                                      type="number"
                                      value={editChargeRate}
                                      onChange={(e) => setEditChargeRate(Number(e.target.value))}
                                      min={0}
                                      max={100}
                                      className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                  </div>
                                ) : (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nominal (Rp)</label>
                                    <input
                                      type="number"
                                      value={editChargeAmount}
                                      onChange={(e) => setEditChargeAmount(Number(e.target.value))}
                                      min={0}
                                      className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                  </div>
                                )}
                                <div className="flex items-center gap-3">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editChargeIncludeInTaxBase}
                                      onChange={(e) => setEditChargeIncludeInTaxBase(e.target.checked)}
                                      className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                                  </label>
                                  <span className="text-xs text-gray-600">Include in Tax Base (DPP)</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    if (!editChargeName) return;
                                    await updateCharge.mutateAsync({
                                      chargeId: charge.id,
                                      partial: {
                                        name: editChargeName,
                                        rate: editChargeType === 'rate' ? editChargeRate : undefined,
                                        amount: editChargeType === 'flat' ? editChargeAmount : undefined,
                                        includeInTaxBase: editChargeIncludeInTaxBase,
                                      },
                                    });
                                    setEditingChargeId(null);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => setEditingChargeId(null)}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Charge Row */
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={charge.isActive}
                                    onChange={(e) => updateCharge.mutateAsync({
                                      chargeId: charge.id,
                                      partial: { isActive: e.target.checked },
                                    })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                                </label>
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{charge.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {charge.rate != null ? `${charge.rate}%` : charge.amount != null ? `Rp ${(charge.amount as number).toLocaleString()}` : '-'}
                                    {charge.includeInTaxBase ? ' · Termasuk DPP' : ' · DPP tidak'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingChargeId(charge.id);
                                    setEditChargeName(charge.name);
                                    setEditChargeType(charge.rate != null ? 'rate' : 'flat');
                                    setEditChargeRate(charge.rate ?? 0);
                                    setEditChargeAmount((charge.amount as number) ?? 0);
                                    setEditChargeIncludeInTaxBase(charge.includeInTaxBase);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                  title="Edit biaya"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteCharge.mutate(charge.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                  title="Hapus biaya"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Charge */}
                <div className="px-6 py-4">
                  <button
                    onClick={() => {
                      if (addingCharge) {
                        setAddingCharge(false);
                        setNewChargeName('');
                        setNewChargeType('rate');
                        setNewChargeRate(0);
                        setNewChargeAmount(0);
                        setNewChargeIncludeInTaxBase(true);
                      } else {
                        setAddingCharge(true);
                      }
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {addingCharge ? 'Batal' : '+ Tambah Biaya'}
                  </button>

                  {addingCharge && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Biaya</label>
                          <input
                            value={newChargeName}
                            onChange={(e) => setNewChargeName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Service Charge"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                          <select
                            value={newChargeType}
                            onChange={(e) => setNewChargeType(e.target.value as 'rate' | 'flat')}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="rate">Persen (%)</option>
                            <option value="flat">Nominal (Rp)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {newChargeType === 'rate' ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tarif (%)</label>
                            <input
                              type="number"
                              value={newChargeRate}
                              onChange={(e) => setNewChargeRate(Number(e.target.value))}
                              min={0}
                              max={100}
                              className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nominal (Rp)</label>
                            <input
                              type="number"
                              value={newChargeAmount}
                              onChange={(e) => setNewChargeAmount(Number(e.target.value))}
                              min={0}
                              className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newChargeIncludeInTaxBase}
                              onChange={(e) => setNewChargeIncludeInTaxBase(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                          </label>
                          <span className="text-xs text-gray-600">Include in Tax Base (DPP)</span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!newChargeName) return;
                          if (newChargeType === 'rate' && newChargeRate <= 0) return;
                          if (newChargeType === 'flat' && newChargeAmount <= 0) return;
                          await addCharge.mutateAsync({
                            id: `charge_${Date.now()}`,
                            name: newChargeName,
                            rate: newChargeType === 'rate' ? newChargeRate : undefined,
                            amount: newChargeType === 'flat' ? newChargeAmount : undefined,
                            includeInTaxBase: newChargeIncludeInTaxBase,
                            priority: activeCharges.length + 1,
                            isActive: true,
                            effectiveDate: new Date().toISOString(),
                          });
                          setNewChargeName('');
                          setNewChargeType('rate');
                          setNewChargeRate(0);
                          setNewChargeAmount(0);
                          setNewChargeIncludeInTaxBase(true);
                          setAddingCharge(false);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Simpan Biaya
                      </button>
                    </div>
                  )}
                </div>
              </section>
  );
}
