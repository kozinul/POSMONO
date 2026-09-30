import { useState } from 'react';
import { usePlatformShiftsSummary, usePlatformPaymentsSummary } from '../../../@shared/hooks/usePlatform';
import { formatCurrency } from '../../../@shared/utils/format';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import { SectionTitle, Loading, cardCls, inputCls } from '../components/platformUi';
import { StatCard } from '../components/platformUi';
import { todayISO, Next30DaysAgo } from '../utils/dates';

export default function SummarySection() {
  const [dateFrom, setDateFrom] = useState(Next30DaysAgo());
  const [dateTo, setDateTo] = useState(todayISO());
  const { data: shifts, isLoading: shiftsLoading } = usePlatformShiftsSummary({ dateFrom, dateTo });
  const { data: payments, isLoading: paymentsLoading } = usePlatformPaymentsSummary({ dateFrom, dateTo });

  return (
    <div className="space-y-6">
      <div className={`${cardCls} flex items-end gap-3`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dari</label>
          <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
          <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Shift Buka" value={shifts?.totals.openShifts ?? 0} loading={shiftsLoading} />
        <StatCard label="Shift Tutup" value={shifts?.totals.closedShifts ?? 0} loading={shiftsLoading} />
        <StatCard label="Total Penjualan (Shift)" value={formatCurrency(shifts?.totals.totalSales ?? 0)} loading={shiftsLoading} />
        <StatCard label="Total Transaksi" value={(shifts?.totals.totalTransactions ?? 0).toString()} loading={shiftsLoading} />
      </div>

      <div className={`${cardCls} space-y-4`}>
        <SectionTitle>Shift per Tenant</SectionTitle>
        {shiftsLoading ? <Loading /> : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Buka</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Tutup</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Tunai</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Non-Tunai</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(shifts?.tenants ?? []).map((t) => (
                  <tr key={t.tenantId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.tenantName ?? t.tenantId}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{t.openShifts}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{t.closedShifts}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{formatCurrency(t.cashSales)}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{formatCurrency(t.nonCashSales)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatCurrency(t.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${cardCls} space-y-4`}>
        <SectionTitle>Penerimaan per Tenant</SectionTitle>
        {paymentsLoading ? <Loading /> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Penerimaan" value={formatCurrency(payments?.totals.totalAmount ?? 0)} loading={paymentsLoading} />
              <StatCard label="Transaksi" value={(payments?.totals.totalTransactions ?? 0).toString()} loading={paymentsLoading} />
              {(payments?.totals.methods ?? []).map((m) => (
                <StatCard key={m.method} label={paymentMethodLabel(m.method)} value={formatCurrency(m.total)} loading={paymentsLoading} />
              ))}
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Transaksi</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(payments?.tenants ?? []).map((t) => (
                    <tr key={t.tenantId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.tenantName ?? t.tenantId}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{t.totalTransactions}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatCurrency(t.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {(t.methods ?? []).map((m) => `${paymentMethodLabel(m.method)} ${formatCurrency(m.total)}`).join(' · ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

