import { useSalesPerCashierReport } from '../hooks/useSalesPerCashierReport';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface SalesPerCashierSectionProps {
  today: string;
  spcFrom: string;
  spcTo: string;
  setSpcFrom: (value: string) => void;
  setSpcTo: (value: string) => void;
}

export default function SalesPerCashierSection({ today, spcFrom, spcTo, setSpcFrom, setSpcTo }: SalesPerCashierSectionProps) {
  const { data: spc, isLoading: spcLoading } = useSalesPerCashierReport(
    spcFrom || today,
    spcTo || today,
  );
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Penjualan per Kasir</h2>
          <p className="text-sm text-gray-400 mt-0.5">Ringkasan penjualan tiap kasir pada periode tertentu</p>
        </div>
        <ExportButtons
          type="sales-per-cashier"
          params={{ dateFrom: spcFrom || today, dateTo: spcTo || today }}
          disabled={!spc || spc.cashiers.length === 0}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={spcFrom} onChange={(e) => setSpcFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={spcTo} onChange={(e) => setSpcTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {spcLoading ? (
          <Spinner />
        ) : spc && spc.cashiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Kasir</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Jumlah Order</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Qty Item</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Total Penjualan</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">DPP</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">SC</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Pajak</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Rata-rata/Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {spc.cashiers.map((c) => (
                  <tr key={c.cashierId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{c.cashierName}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.totalItems}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.dpp)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.serviceCharge)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.tax)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.avgOrderValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right text-gray-900">{spc.totals.totalOrders}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{spc.totals.totalItems}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.totalRevenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.dpp)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.serviceCharge)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spc.totals.tax)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(spc.totals.totalOrders > 0 ? Math.round(spc.totals.totalRevenue / spc.totals.totalOrders) : 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Tidak ada penjualan pada periode ini</p>
        )}
      </div>
    </section>
  );
}
