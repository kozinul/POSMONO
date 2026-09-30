import { useState } from 'react';
import { useAddTaxRule, useDeleteTaxRule, useCalculateTax } from '../../../@shared/hooks/useTaxConfiguration';
import type { ITaxConfiguration, ITaxRule, IModifierConfig } from '../../../@shared/hooks/useTaxConfiguration';

export interface TaxRulesSectionProps {
  taxConfig?: ITaxConfiguration;
  taxLoading: boolean;
  activeRules: ITaxRule[];
}

export default function TaxRulesSection({ taxConfig, taxLoading, activeRules }: TaxRulesSectionProps) {
  const addRule = useAddTaxRule();
  const deleteRule = useDeleteTaxRule();
  const calcTax = useCalculateTax();

  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [addingRule, setAddingRule] = useState(false);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTaxType, setNewRuleTaxType] = useState<ITaxRule['taxType']>('vat');
  const [newRuleRate, setNewRuleRate] = useState(0);
  const [calcMode, setCalcMode] = useState<'standard' | 'custom'>('standard');
  const [modifierType, setModifierType] = useState<IModifierConfig['type']>('none');
  const [modifierNumerator, setModifierNumerator] = useState(11);
  const [modifierDenominator, setModifierDenominator] = useState(12);
  const [modifierMultiplier, setModifierMultiplier] = useState(0.8);
  const [modifierDeduction, setModifierDeduction] = useState(0);

  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Aturan Pajak</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Kelola aturan pajak aktif untuk toko Anda</p>
                </div>

                {/* Active Rules List */}
                <div className="px-6 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Aturan Aktif</h3>
                  {taxLoading ? (
                    <div className="text-sm text-gray-400">Memuat...</div>
                  ) : activeRules.length === 0 ? (
                    <div className="text-sm text-gray-400">Belum ada aturan pajak. Tambahkan aturan baru.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeRules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{rule.name}</p>
                              <p className="text-xs text-gray-400">
                                {rule.taxType === 'vat' ? 'Pajak' : rule.taxType === 'withholding' ? 'PPh' : rule.taxType === 'exemption' ? 'Pengecualian' : rule.taxType} — {rule.policy.value}
                                {rule.policy.type !== 'amount' ? '%' : ''}
                                {rule.modifier && rule.modifier.type === 'fraction' && (rule.modifier.config?.denominator ?? 0) > 0
                                  ? ` (efektif: ${(rule.policy.value * (rule.modifier.config?.numerator as number) / (rule.modifier.config?.denominator as number)).toFixed(2)}%)`
                                  : ''}
                                {rule.scope.type !== 'all' && ` · ${rule.scope.entityName}`}
                              </p>
                            </div>
                          </div>
                          {rule.isActive && (
                            <button
                              onClick={() => deleteRule.mutate(rule.id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Hapus aturan"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Rule */}
                <div className="px-6 py-4 border-b border-gray-50">
                  <button
                    onClick={() => {
                      if (addingRule) {
                        setAddingRule(false);
                        setCalcMode('standard');
                        setModifierType('none');
                      } else {
                        setAddingRule(true);
                      }
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {addingRule ? 'Batal' : '+ Tambah Aturan Pajak'}
                  </button>

                  {addingRule && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      {/* Presets */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Template Pajak</label>
                        <select
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'ppn') {
                              setNewRuleName('Pajak 12%');
                              setNewRuleTaxType('vat');
                              setNewRuleRate(12);
                              setCalcMode('custom');
                              setModifierType('fraction');
                              setModifierNumerator(11);
                              setModifierDenominator(12);
                            } else if (v === 'pph') {
                              setNewRuleName('PPh Pasal 23');
                              setNewRuleTaxType('withholding');
                              setNewRuleRate(2);
                              setCalcMode('standard');
                              setModifierType('none');
                            } else if (v === 'exempt') {
                              setNewRuleName('Bebas Pajak');
                              setNewRuleTaxType('exemption');
                              setNewRuleRate(0);
                              setCalcMode('standard');
                              setModifierType('none');
                            }
                          }}
                          defaultValue=""
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="" disabled>Pilih template...</option>
                          <option value="ppn">🇮🇩 Pajak Indonesia 12%</option>
                          <option value="pph">📋 PPh Pasal 23 (2%)</option>
                          <option value="exempt">✅ Bebas Pajak</option>
                          <option value="custom">⚙️ Kustom</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Pajak</label>
                          <input
                            value={newRuleName}
                            onChange={(e) => setNewRuleName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Pajak 12%"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                          <select
                            value={newRuleTaxType}
                            onChange={(e) => setNewRuleTaxType(e.target.value as any)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="vat">Pajak</option>
                            <option value="withholding">PPh</option>
                            <option value="custom">Kustom</option>
                            <option value="exemption">Pengecualian</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tarif (%)</label>
                          <input
                            type="number"
                            value={newRuleRate}
                            onChange={(e) => setNewRuleRate(Number(e.target.value))}
                            min={0}
                            max={100}
                            className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Metode Perhitungan</label>
                          <select
                            value={calcMode}
                            onChange={(e) => {
                              const mode = e.target.value as 'standard' | 'custom';
                              setCalcMode(mode);
                              if (mode === 'standard') setModifierType('none');
                            }}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="standard">Standard</option>
                            <option value="custom">Kustom</option>
                          </select>
                        </div>
                      </div>

                      {/* Custom Formula Section */}
                      {calcMode === 'custom' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Custom Modifier</h4>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Modifier</label>
                            <select
                              value={modifierType}
                              onChange={(e) => setModifierType(e.target.value as any)}
                              className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="none">None</option>
                              <option value="fraction">Fraction</option>
                              <option value="multiplier">Multiplier</option>
                              <option value="fixed_deduction">Fixed Deduction</option>
                            </select>
                          </div>

                          {modifierType === 'fraction' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Pembilang (Numerator)</label>
                                <input
                                  type="number"
                                  value={modifierNumerator}
                                  onChange={(e) => setModifierNumerator(Number(e.target.value))}
                                  className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Penyebut (Denominator)</label>
                                <input
                                  type="number"
                                  value={modifierDenominator}
                                  onChange={(e) => setModifierDenominator(Number(e.target.value))}
                                  className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {modifierType === 'multiplier' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Nilai Pengali</label>
                              <input
                                type="number"
                                step={0.1}
                                value={modifierMultiplier}
                                onChange={(e) => setModifierMultiplier(Number(e.target.value))}
                                className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}

                          {modifierType === 'fixed_deduction' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Pengurangan Tetap (Rp)</label>
                              <input
                                type="number"
                                value={modifierDeduction}
                                onChange={(e) => setModifierDeduction(Number(e.target.value))}
                                className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}

                          {/* Formula Preview */}
                          {modifierType !== 'none' && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                              <p className="text-xs font-medium text-blue-700 mb-1">Preview Formula</p>
                              <p className="text-sm text-blue-800 font-mono">
                                {modifierType === 'fraction' && (
                                  <>Jumlah × ({modifierNumerator} / {modifierDenominator})</>
                                )}
                                {modifierType === 'multiplier' && (
                                  <>Jumlah × {modifierMultiplier}</>
                                )}
                                {modifierType === 'fixed_deduction' && (
                                  <>Jumlah − {modifierDeduction.toLocaleString()}</>
                                )}
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                Contoh: Rp100.000 → Rp
                                {modifierType === 'fraction' && ((100000 * modifierNumerator) / modifierDenominator).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {modifierType === 'multiplier' && (100000 * modifierMultiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {modifierType === 'fixed_deduction' && Math.max(0, 100000 - modifierDeduction).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={async () => {
                          if (!newRuleName || newRuleRate <= 0) return;
                          const modifier = calcMode === 'custom' && modifierType !== 'none'
                            ? {
                                type: modifierType,
                                config: modifierType === 'fraction'
                                  ? { numerator: modifierNumerator, denominator: modifierDenominator }
                                  : modifierType === 'multiplier'
                                  ? { multiplier: modifierMultiplier }
                                  : modifierType === 'fixed_deduction'
                                  ? { deduction: modifierDeduction }
                                  : {},
                              }
                            : undefined;
                          await addRule.mutateAsync({
                            id: `rule_${Date.now()}`,
                            name: newRuleName,
                            taxType: newRuleTaxType,
                            priority: 10,
                            scope: { type: 'all', entityId: '', entityName: 'Semua' },
                            policy: {
                              type: 'rate',
                              value: newRuleRate,
                              roundingMode: 'round',
                              precision: 2,
                            },
                            modifier,
                            isActive: true,
                            effectiveDate: new Date().toISOString(),
                          });
                          setNewRuleName('');
                          setNewRuleRate(0);
                          setCalcMode('standard');
                          setModifierType('none');
                          setAddingRule(false);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Simpan Aturan
                      </button>
                    </div>
                  )}
                </div>

                {/* Test Calculator */}
                <div className="px-6 py-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Kalkulator Uji Coba</h3>
                  <p className="text-xs text-gray-400 mb-3">Masukkan nominal untuk melihat hasil perhitungan pajak</p>
                  <div className="flex gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Total Belanja (Rp)</label>
                      <input
                        type="number"
                        id="calc-amount"
                        defaultValue={100000}
                        className="block w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const el = document.getElementById('calc-amount') as HTMLInputElement;
                        const amount = parseInt(el?.value || '0');
                        const tenantId = taxConfig?.tenantId ?? '';
                        const result = await calcTax.mutateAsync({
                          tenantId,
                          items: [{ productId: 'test', productName: 'Sample', quantity: 1, unitPrice: amount }],
                        });
                        setCalcResult(
                          `Subtotal: Rp${result.subtotal.toLocaleString()} | Pajak: Rp${result.totalTax.toLocaleString()} | Service: Rp${result.serviceCharge.toLocaleString()} | Total: Rp${result.grandTotal.toLocaleString()}`
                        );
                      }}
                      className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
                    >
                      Hitung
                    </button>
                  </div>
                  {calcResult && (
                    <p className="mt-3 text-sm text-gray-700 bg-blue-50 px-4 py-3 rounded-lg">{calcResult}</p>
                  )}
                </div>
              </section>
  );
}
