import { useState } from 'react';
import { useDailyReport, useSalesReport } from '../../orders/hooks/useOrders';

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export default function ReportPage() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const { data: daily, isLoading: dailyLoading } = useDailyReport(selectedDate);
  const { data: sales, isLoading: salesLoading } = useSalesReport(
    dateFrom || today,
    dateTo || today,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Report</h2>
          <div className="mb-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {dailyLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
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

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Report</h2>
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          {salesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
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
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Orders in Period</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {sales.orders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-700">{order.orderNumber}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(order.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a date range</p>
          )}
        </div>
      </div>
    </div>
  );
}
