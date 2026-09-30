import { useState } from 'react';
import { usePlatformHubs, usePlatformHubConsolidated } from '../../../@shared/hooks/usePlatform';
import { formatCurrency } from '../../../@shared/utils/format';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import { Loading, StatCard, cardCls, inputCls } from '../components/platformUi';
import { todayISO, Next30DaysAgo } from '../utils/dates';

export default function ConsolidatedSection({
  hubId,
  onHubChange,
}: {
  hubId: string;
  onHubChange: (hubId: string) => void;
}) {
  const { data: hubs = [] } = usePlatformHubs();
  const [dateFrom, setDateFrom] = useState(Next30DaysAgo());
  const [dateTo, setDateTo] = useState(todayISO());
  const { data, isLoading, isFetching } = usePlatformHubConsolidated(hubId || null, dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hub</label>
          <select className={inputCls + ' w-80'} value={hubId} onChange={(e) => onHubChange(e.target.value)}>
            <option value="">Pilih hub...</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dari</label>
          <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
          <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {!hubId ? (
        <div className={cardCls}><p className="text-sm text-gray-500">Pilih hub untuk melihat konsolidasi Tenant → Outlet.</p></div>
      ) : isLoading ? (
        <Loading />
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Tenant" value={data.tenantCount} />
            <StatCard label="Shift Buka / Tutup" value={`${data.totals.openShifts} / ${data.totals.closedShifts}`} />
            <StatCard label="Penjualan (Shift)" value={formatCurrency(data.totals.shiftSales)} loading={isFetching} />
            <StatCard label="Penerimaan (Pembayaran)" value={formatCurrency(data.totals.paymentAmount)} loading={isFetching} />
          </div>

          <div className={`${cardCls} space-y-6`}>
            {data.tenants.map((tenant) => (
              <div key={tenant.tenantId} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-gray-900">{tenant.tenantName ?? tenant.tenantId}</h3>
                  <span className="text-xs text-gray-500">
                    Shift {tenant.totals.shiftTransactions} trans · {formatCurrency(tenant.totals.shiftSales)} &nbsp;|&nbsp;
                    Bayar {tenant.totals.paymentTransactions} trans · {formatCurrency(tenant.totals.paymentAmount)}
                  </span>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">Shift Buka/Tutup</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">Penjualan Shift</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">Penerimaan</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tenant.outlets.map((outlet) => (
                      <tr key={outlet.outletId ?? 'default'} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{outlet.outletName ?? outlet.outletId ?? 'Tanpa outlet'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500 text-right">{outlet.shifts.openShifts} / {outlet.shifts.closedShifts}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(outlet.shifts.totalSales)}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(outlet.payments.totalAmount)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {(outlet.payments.methods ?? []).map((m) => `${paymentMethodLabel(m.method)} ${formatCurrency(m.total)}`).join(' · ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

