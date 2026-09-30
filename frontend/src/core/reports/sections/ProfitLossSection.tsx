import { useProfitLossReport } from '../hooks/useProfitLossReport';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface ProfitLossSectionProps {
  today: string;
  plFrom: string;
  plTo: string;
  setPlFrom: (value: string) => void;
  setPlTo: (value: string) => void;
}

export default function ProfitLossSection({ today, plFrom, plTo, setPlFrom, setPlTo }: ProfitLossSectionProps) {
  const { data: pl, isLoading: plLoading } = useProfitLossReport(plFrom || today, plTo || today);
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Laba Rugi</h2>
          <p className="text-sm text-gray-400 mt-0.5">Pendapatan dikurangi HPP & biaya periode</p>
        </div>
        <ExportButtons
          type="profit-loss"
          params={{ dateFrom: plFrom || today, dateTo: plTo || today }}
          disabled={!pl}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={plFrom} onChange={(e) => setPlFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={plTo} onChange={(e) => setPlTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {plLoading ? (
          <Spinner />
        ) : pl ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Order</p>
                <p className="text-xl font-bold text-gray-900">{pl.totalOrders}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Pendapatan</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pl.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">HPP (COGS)</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(pl.totalCogs)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Laba Kotor</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(pl.grossProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Margin Kotor</p>
                <p className="text-xl font-bold text-gray-900">{pl.grossMarginPct}%</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metrik</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">Total Order</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-semibold">{pl.totalOrders}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">Total Pendapatan</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(pl.totalRevenue)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">HPP (Harga Pokok Penjualan) · {pl.cogsUnits} unit</td>
                    <td className="px-4 py-2 text-sm text-red-600 text-right">{formatCurrency(pl.totalCogs)}</td>
                  </tr>
                  <tr className="bg-emerald-50/50 hover:bg-emerald-50">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900">Laba Kotor</td>
                    <td className="px-4 py-2 text-sm font-semibold text-emerald-700 text-right">{formatCurrency(pl.grossProfit)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">Margin Kotor</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{pl.grossMarginPct}%</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">Diskon</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">-{formatCurrency(pl.totalDiscount)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">Pajak (PPN)</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">-{formatCurrency(pl.totalTax)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">Service Charge</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">-{formatCurrency(pl.totalServiceCharge)}</td>
                  </tr>
                  {pl.totalRounding != null && pl.totalRounding !== 0 && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">Pembulatan</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        {pl.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(pl.totalRounding))}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-emerald-50 hover:bg-emerald-50">
                    <td className="px-4 py-2 text-sm font-bold text-gray-900">Laba Bersih</td>
                    <td className="px-4 py-2 text-sm font-bold text-emerald-700 text-right">{formatCurrency(pl.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a date range</p>
        )}
      </div>
    </section>
  );
}
