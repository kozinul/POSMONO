import { useDailyReport } from '../../orders/hooks/useOrders';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface DailySectionProps {
  selectedDate: string;
  setSelectedDate: (value: string) => void;
}

export default function DailySection({ selectedDate, setSelectedDate }: DailySectionProps) {
  const { data: daily, isLoading: dailyLoading } = useDailyReport(selectedDate);
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Harian</h2>
          <p className="text-sm text-gray-400 mt-0.5">Ringkasan transaksi per tanggal</p>
        </div>
        <ExportButtons type="daily" params={{ date: selectedDate }} disabled={!daily} />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="max-w-xs">
          <label className={labelCls}>Tanggal</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={inputCls}
          />
        </div>
        {dailyLoading ? (
          <Spinner />
        ) : daily ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Orders</p>
                <p className="text-xl font-bold text-gray-900">{daily.totalOrders}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(daily.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Items Sold</p>
                <p className="text-xl font-bold text-gray-900">{daily.totalItems}</p>
              </div>
            </div>
            {daily.totalRounding != null && daily.totalRounding !== 0 && (
              <div className="flex justify-between text-sm bg-purple-50 rounded-lg p-3">
                <span className="text-purple-700">Total Pembulatan (termasuk revenue)</span>
                <span className="text-purple-800 font-bold">
                  {daily.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(daily.totalRounding))}
                </span>
              </div>
            )}
            {daily.shifts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Shifts</h3>
                <div className="space-y-2">
                  {daily.shifts.map((shift: any) => (
                    <div key={shift.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                      <div>
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${shift.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-gray-700">
                          Opened: {new Date(shift.openedAt).toLocaleTimeString('id-ID')}
                        </span>
                      </div>
                      <span className="text-gray-500">
                        Balance: {formatCurrency(shift.openingBalance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No data for this date</p>
        )}
      </div>
    </section>
  );
}
