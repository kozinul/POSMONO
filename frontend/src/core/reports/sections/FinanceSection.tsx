import { useFinanceReport } from '../../orders/hooks/useOrders';
import { useCategoryName } from '../hooks/useCategoryName';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface FinanceSectionProps {
  today: string;
  financeFrom: string;
  financeTo: string;
  setFinanceFrom: (value: string) => void;
  setFinanceTo: (value: string) => void;
}

export default function FinanceSection({ today, financeFrom, financeTo, setFinanceFrom, setFinanceTo }: FinanceSectionProps) {
  const { data: finance, isLoading: financeLoading } = useFinanceReport(
    financeFrom || today,
    financeTo || today,
  );
  const getCategoryName = useCategoryName();
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Keuangan</h2>
          <p className="text-sm text-gray-400 mt-0.5">Ringkasan keuangan, pajak, dan diskon</p>
        </div>
        <ExportButtons
          type="finance"
          params={{ dateFrom: financeFrom || today, dateTo: financeTo || today }}
          disabled={!finance}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={financeFrom} onChange={(e) => setFinanceFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={financeTo} onChange={(e) => setFinanceTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {financeLoading ? (
          <Spinner />
        ) : finance ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nett (DPP)</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.netRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pajak (PPN)</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalTax)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Service Charge</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalServiceCharge)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Diskon</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(finance.totalDiscount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Orders</p>
                <p className="text-xl font-bold text-gray-900">{finance.totalOrders}</p>
              </div>
              {finance.totalRounding != null && finance.totalRounding !== 0 && (
                <div>
                  <p className="text-xs text-gray-500">Pembulatan (termasuk revenue)</p>
                  <p className="text-xl font-bold text-gray-900">
                    {finance.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(finance.totalRounding))}
                  </p>
                </div>
              )}
            </div>

            {finance.categories.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">DPP</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pajak</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SC</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {finance.categories.map((cat, idx) => (
                      <tr key={cat.categoryId ?? `uncat-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{getCategoryName(cat.categoryId)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">{cat.totalItems}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(cat.revenue)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatCurrency(cat.dpp)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatCurrency(cat.tax)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatCurrency(cat.serviceCharge)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a date range</p>
        )}
      </div>
    </section>
  );
}
