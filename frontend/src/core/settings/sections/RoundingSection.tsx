import { formatRounding } from '../utils/taxConfig';

export type RoundingMode = 'nearest' | 'up' | 'down';

export interface RoundingSectionProps {
  roundingEnabled: boolean;
  setRoundingEnabled: (value: boolean) => void;
  roundingMode: RoundingMode;
  setRoundingMode: (value: RoundingMode) => void;
  roundingDenomination: number;
  setRoundingDenomination: (value: number) => void;
}

export default function RoundingSection({
  roundingEnabled,
  setRoundingEnabled,
  roundingMode,
  setRoundingMode,
  roundingDenomination,
  setRoundingDenomination,
}: RoundingSectionProps) {
  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Pembulatan Total</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Bulatkan total pembayaran tunai ke nominal yang genap</p>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Aktifkan Pembulatan</p>
                      <p className="text-sm text-gray-400">Berlaku hanya untuk pembayaran tunai (cash)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roundingEnabled}
                        onChange={(e) => setRoundingEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {roundingEnabled && (
                    <>
                      <div className="border-t border-gray-100" />
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Denominasi</label>
                        <select
                          value={roundingDenomination}
                          onChange={(e) => setRoundingDenomination(Number(e.target.value))}
                          className="block w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value={0}>Tidak ada pembulatan</option>
                          <option value={100}>Rp 100</option>
                          <option value={500}>Rp 500</option>
                          <option value={1000}>Rp 1.000</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          Total akan dibulatkan ke kelipatan {roundingDenomination > 0 ? `Rp ${formatRounding(roundingDenomination)}` : 'nominal yang dipilih'}.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Mode Pembulatan</label>
                        <select
                          value={roundingMode}
                          onChange={(e) => setRoundingMode(e.target.value as 'nearest' | 'up' | 'down')}
                          className="block w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="nearest">Terdekat (round)</option>
                          <option value="up">Ke Atas (ceil)</option>
                          <option value="down">Ke Bawah (floor)</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          {roundingMode === 'nearest'
                            ? 'Total dibulatkan ke kelipatan terdekat (mis. Rp 1.240 → Rp 1.200 atau Rp 1.300)'
                            : roundingMode === 'up'
                              ? 'Total selalu dibulatkan ke atas (mis. Rp 1.240 → Rp 1.300)'
                              : 'Total selalu dibulatkan ke bawah (mis. Rp 1.240 → Rp 1.200)'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </section>
  );
}
