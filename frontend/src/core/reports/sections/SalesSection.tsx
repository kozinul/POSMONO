import { useSalesReport } from '../../orders/hooks/useOrders';
import { useCategoryName } from '../hooks/useCategoryName';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface SalesSectionProps {
  today: string;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
}

export default function SalesSection({ today, dateFrom, dateTo, setDateFrom, setDateTo }: SalesSectionProps) {
  const { data: sales, isLoading: salesLoading } = useSalesReport(
    dateFrom || today,
    dateTo || today,
  );
  const getCategoryName = useCategoryName();
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Penjualan</h2>
          <p className="text-sm text-gray-400 mt-0.5">Ringkasan penjualan pada periode tertentu</p>
        </div>
        <ExportButtons
          type="sales"
          params={{ dateFrom: dateFrom || today, dateTo: dateTo || today }}
          disabled={!sales}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {salesLoading ? (
          <Spinner />
        ) : sales ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Orders</p>
                <p className="text-xl font-bold text-gray-900">{sales.totalOrders}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(sales.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Items Sold</p>
                <p className="text-xl font-bold text-gray-900">{sales.totalItems}</p>
              </div>
            </div>
            {sales.totalRounding != null && sales.totalRounding !== 0 && (
              <div className="flex justify-between text-sm bg-purple-50 rounded-lg p-3">
                <span className="text-purple-700">Total Pembulatan (termasuk revenue)</span>
                <span className="text-purple-800 font-bold">
                  {sales.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(sales.totalRounding))}
                </span>
              </div>
            )}
            {sales.salesByCategory && sales.salesByCategory.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Penjualan per Kategori</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sales.salesByCategory.map((cat, idx) => (
                        <tr key={cat.categoryId ?? `uncat-${idx}`} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{getCategoryName(cat.categoryId)}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 text-right">{cat.totalItems}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(cat.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Orders in Period</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {sales.orders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between text-sm py-1">
                    <span className="text-gray-700">{order.orderNumber}</span>
                    <span className="flex items-center gap-2">
                      {order.roundingAdjustment != null && order.roundingAdjustment !== 0 && (
                        <span className="text-xs text-purple-600">
                          {order.roundingAdjustment > 0 ? '+' : '-'}{formatCurrency(Math.abs(order.roundingAdjustment))}
                        </span>
                      )}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(order.total + (order.roundingAdjustment ?? 0))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a date range</p>
        )}
      </div>
    </section>
  );
}
