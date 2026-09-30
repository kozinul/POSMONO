import type { IModifierConfig, ITaxConfiguration } from '../../../@shared/hooks/useTaxConfiguration';

export type PricingMode = ITaxConfiguration['pricingMode'];
export type ModifierType = IModifierConfig['type'];

export interface TaxSectionProps {
  taxEnabled: boolean;
  setTaxEnabled: (value: boolean) => void;
  pricingMode: PricingMode;
  setPricingMode: (value: PricingMode) => void;
  ppnEnabled: boolean;
  setPpnEnabled: (value: boolean) => void;
  ppnRate: number;
  setPpnRate: (value: number) => void;
  ppnModifierType: ModifierType;
  setPpnModifierType: (value: ModifierType) => void;
  ppnModifierNumerator: number;
  setPpnModifierNumerator: (value: number) => void;
  ppnModifierDenominator: number;
  setPpnModifierDenominator: (value: number) => void;
}

export default function TaxSection({
  taxEnabled,
  setTaxEnabled,
  pricingMode,
  setPricingMode,
  ppnEnabled,
  setPpnEnabled,
  ppnRate,
  setPpnRate,
  ppnModifierType,
  setPpnModifierType,
  ppnModifierNumerator,
  setPpnModifierNumerator,
  ppnModifierDenominator,
  setPpnModifierDenominator,
}: TaxSectionProps) {
  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Pajak & Service Charge</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Aturan perpajakan dan service charge sesuai Indonesia</p>
                </div>
                <div className="px-6 py-5 space-y-5">
                  {/* Tax Enabled */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Aktifkan Pajak</p>
                      <p className="text-sm text-gray-400">Hitung pajak otomatis untuk setiap transaksi</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxEnabled}
                        onChange={(e) => setTaxEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Pricing Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Mode Harga</label>
                    <select
                      value={pricingMode}
                      onChange={(e) => setPricingMode(e.target.value as 'inclusive' | 'exclusive')}
                      className="block w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="exclusive">Exclusive (Pajak + harga = total)</option>
                      <option value="inclusive">Inclusive (Harga sudah termasuk pajak)</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {pricingMode === 'exclusive'
                        ? 'Pajak ditambahkan di atas harga barang'
                        : 'Harga barang sudah termasuk pajak (hanya service charge ditambahkan)'}
                    </p>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Tax Rate */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Tarif Pajak</p>
                      <p className="text-sm text-gray-400">Atur tarif pajak default untuk transaksi</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ppnEnabled}
                        onChange={(e) => {
                          setPpnEnabled(e.target.checked);
                          if (e.target.checked) setPpnRate(11);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                  {taxEnabled && ppnEnabled && (
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1.5">Tarif Pajak (%)</label>
                          <input
                            type="number"
                            value={ppnRate}
                            onChange={(e) => setPpnRate(Number(e.target.value))}
                            min={0}
                            max={100}
                            className="block w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1.5">Dasar Pengenaan Pajak (DPP)</label>
                          <select
                            value={ppnModifierType}
                            onChange={(e) => setPpnModifierType(e.target.value as any)}
                            className="block w-44 px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="none">Tanpa modifier (100%)</option>
                            <option value="fraction">Pecahan (a/b)</option>
                            <option value="multiplier">Multiplier</option>
                            <option value="fixed_deduction">Potongan tetap</option>
                          </select>
                        </div>
                      </div>
                      {ppnModifierType === 'fraction' && (
                        <div className="flex gap-3 items-end">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Pembilang (a)</label>
                            <input
                              type="number"
                              value={ppnModifierNumerator}
                              onChange={(e) => setPpnModifierNumerator(Number(e.target.value))}
                              className="block w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Penyebut (b)</label>
                            <input
                              type="number"
                              value={ppnModifierDenominator}
                              onChange={(e) => setPpnModifierDenominator(Number(e.target.value))}
                              className="block w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                      {ppnModifierType === 'fraction' && ppnModifierDenominator > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-800 mb-1">Perhitungan Efektif</p>
                          <p className="text-sm text-blue-700">
                            DPP = Harga × {ppnModifierNumerator}/{ppnModifierDenominator}
                            {ppnModifierDenominator > 0 && (
                              <> = Harga × {(ppnModifierNumerator / ppnModifierDenominator * 100).toFixed(2)}%</>
                            )}
                          </p>
                          <p className="text-sm text-blue-700 mt-1">
                            Pajak Efektif = {ppnRate}% × {ppnModifierNumerator}/{ppnModifierDenominator}
                            {ppnModifierDenominator > 0 && (
                              <> = {(ppnRate * ppnModifierNumerator / ppnModifierDenominator).toFixed(2)}%</>
                            )}
                          </p>
                        </div>
                      )}
                      {ppnModifierType !== 'fraction' && (
                        <p className="text-xs text-gray-400">
                          {ppnModifierType === 'none' 
                            ? `Pajak efektif: ${ppnRate}% dari harga jual.`
                            : ppnModifierType === 'multiplier'
                            ? `DPP = Harga × multiplier, lalu pajak ${ppnRate}% dari DPP.`
                            : `DPP = Harga - potongan tetap, lalu pajak ${ppnRate}% dari DPP.`
                          }
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
  );
}
