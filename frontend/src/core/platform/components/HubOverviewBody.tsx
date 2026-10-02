import type { HubOverview, HubOverviewOutlet } from '../../../@shared/hooks/useHubOverview';
import { formatCurrency } from '../../../@shared/utils/format';
import { Badge, EmptyState, ErrorNote, Loading, StatCard, apiErrorMessage, cardCls } from './platformUi';

/**
 * The overview read model minus the hub itself: the hub name is already in the
 * page header, and the two callers (Terminal Center and the hub member page)
 * carry different hub shapes. Only the sections below are shared.
 */
export type HubOverviewSections = Omit<HubOverview, 'hub'>;

function subscriptionBadge(status: string) {
  const tone = status === 'active' ? 'green' : status === 'cancelled' ? 'red' : 'amber';
  return <Badge tone={tone}>{status}</Badge>;
}

function OutletRow({ outlet }: { outlet: HubOverviewOutlet }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-3">
        <span className="text-sm font-medium text-gray-900">{outlet.outletName ?? '(outlet dihapus)'}</span>
        {!outlet.isActive && (
          <Badge tone="gray">nonaktif</Badge>
        )}
      </td>
      <td className="py-2 pr-3 text-sm text-gray-600">{outlet.tenantName ?? outlet.tenantId}</td>
      <td className="py-2 pr-3">
        {outlet.hasOpenShift ? (
          <Badge tone="green">shift buka · {outlet.openShifts}</Badge>
        ) : outlet.isStale ? (
          <Badge tone="amber">perhatian</Badge>
        ) : (
          <Badge tone="gray">tertutup</Badge>
        )}
      </td>
      <td className="py-2 text-sm text-gray-600">
        {outlet.lastShiftAt ? new Date(outlet.lastShiftAt).toLocaleString('id-ID') : 'belum pernah'}
      </td>
    </tr>
  );
}

/**
 * Fase 22 — extracted verbatim from `HubOverviewPanel` so the hub member page
 * renders the *same* overview as the Terminal Center instead of a second copy
 * that drifts. Presentation only: the caller owns the query and the date range.
 */
export default function HubOverviewBody({
  data,
  isLoading,
  isFetching,
  error,
  onRefetch,
}: {
  data: HubOverviewSections | null | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRefetch: () => void;
}) {
  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className={cardCls}>
        <ErrorNote>{apiErrorMessage(error, 'Gagal memuat overview hub.')}</ErrorNote>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cardCls}>
        <EmptyState>Belum ada data overview untuk hub ini.</EmptyState>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tenant" value={data.counts.tenants} />
        <StatCard label="Outlet Aktif" value={`${data.counts.activeOutlets} / ${data.counts.outlets}`} />
        <StatCard label="Anggota" value={data.counts.members} />
        <StatCard label="Penjualan Periode" value={formatCurrency(data.sales.total)} loading={isFetching} />
      </div>

      {data.operational.outletsStale > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {data.operational.outletsStale} outlet tidak punya shift buka dan aktivitas terakhirnya lebih dari{' '}
          {data.operational.staleHours} jam (atau belum pernah membuka shift). Periksa shift kasir di outlet tersebut.
        </div>
      )}

      <div className={`${cardCls} space-y-3`}>
        <h3 className="font-semibold text-gray-900">Status Outlet</h3>
        <p className="text-xs text-gray-500">
          {data.operational.outletsWithOpenShift} outlet sedang buka shift
          {data.operational.outletsWithoutShift > 0 && ` · ${data.operational.outletsWithoutShift} outlet belum pernah buka shift`}
        </p>
        {data.operational.outlets.length === 0 ? (
          <EmptyState>Belum ada outlet di hub ini.</EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-1">Outlet</th>
                <th className="pb-1">Tenant</th>
                <th className="pb-1">Status</th>
                <th className="pb-1">Shift terakhir</th>
              </tr>
            </thead>
            <tbody>
              {data.operational.outlets.map((o) => (
                <OutletRow key={`${o.tenantId}:${o.outletId ?? 'default'}`} outlet={o} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${cardCls} space-y-3`}>
        <h3 className="font-semibold text-gray-900">Penjualan per Tenant</h3>
        <p className="text-xs text-gray-500">{data.sales.transactions} transaksi dalam periode terpilih.</p>
        {data.sales.byTenant.length === 0 ? (
          <EmptyState>Belum ada tenant di hub ini.</EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-1">Tenant</th>
                <th className="pb-1">Transaksi</th>
                <th className="pb-1 text-right">Penjualan</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.byTenant.map((t) => (
                <tr key={t.tenantId} className="border-t border-gray-100">
                  <td className="py-2 text-sm font-medium text-gray-900">{t.tenantName ?? t.tenantId}</td>
                  <td className="py-2 text-sm text-gray-600">{t.transactions}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${cardCls} space-y-3`}>
        <h3 className="font-semibold text-gray-900">Langganan Tenant</h3>
        {data.subscription.length === 0 ? (
          <EmptyState>Tidak ada tenant berlangganan pada periode ini.</EmptyState>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-1">Tenant</th>
                <th className="pb-1">Paket</th>
                <th className="pb-1">Status</th>
                <th className="pb-1 text-right">Sisa hari</th>
              </tr>
            </thead>
            <tbody>
              {data.subscription.map((s) => (
                <tr key={s.tenantId} className="border-t border-gray-100">
                  <td className="py-2 text-sm font-medium text-gray-900">{s.tenantName ?? s.tenantId}</td>
                  <td className="py-2 text-sm text-gray-600">{s.planName ?? '-'}</td>
                  <td className="py-2">{subscriptionBadge(s.status)}</td>
                  <td className="py-2 text-sm text-gray-600 text-right">{s.daysRemaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}