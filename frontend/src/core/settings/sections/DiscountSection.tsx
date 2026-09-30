
export interface DiscountSectionProps {
  discountMaxPercent: number;
  setDiscountMaxPercent: (value: number) => void;
  discountMaxNominal: number;
  setDiscountMaxNominal: (value: number) => void;
}

export default function DiscountSection({
  discountMaxPercent,
  setDiscountMaxPercent,
  discountMaxNominal,
  setDiscountMaxNominal,
}: DiscountSectionProps) {
  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Batas Diskon</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Batasan maksimal diskon untuk mencegah kesalahan kasir</p>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Maks Diskon (%)</label>
                    <input
                      type="number"
                      value={discountMaxPercent}
                      onChange={(e) => setDiscountMaxPercent(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Maks Diskon (Rp)</label>
                    <input
                      type="number"
                      value={discountMaxNominal}
                      onChange={(e) => setDiscountMaxNominal(Number(e.target.value))}
                      min={0}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </section>
  );
}
