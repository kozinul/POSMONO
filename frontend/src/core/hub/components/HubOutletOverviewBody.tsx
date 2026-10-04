import type { MyHubOutletOverview } from '../../../@shared/hooks/useMyHub';
import { formatCurrency } from '../../../@shared/utils/format';
import {
  Badge,
  EmptyState,
  ErrorNote,
  Loading,
  StatCard,
  apiErrorMessage,
  cardCls,
} from '../../platform/components/platformUi';

/** Fase 23 — a 403 here is a role decision, not a failure to retry. */
function isForbidden(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 403;
}

function ShiftStatusBadge({ operational }: { operational: MyHubOutletOverview['operational'] }) {
  if (operational.hasOpenShift) {
    return <Badge tone="green">shift buka · {operational.openShifts}</Badge>;
  }
  if (operational.isStale) {
    return <Badge tone="amber">perhatian</Badge>;
  }
  return <Badge tone="gray">tertutup</Badge>;
}

/**
 * Fase 23 — the outlet screen's body.
 *
 * Deliberately **not** `HubOverviewBody`: that renders a *group* (a tenant list, an
 * outlet table, hub-wide counts), and reusing it here would put rows this screen has
 * no meaning for. What is shared with the group view is the period picker and the
 * stale rule, not the layout.
 *
 * Presentation only — the caller owns the query, the date range and the outlet.
 */
export default function HubOutletOverviewBody({
  data,
  isLoading,
  isFetching,
  error,
}: {
  data: MyHubOutletOverview | null | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    // Saying "you may not see this" beats showing a raw status code: the endpoint
    // answers 403 for a role without `hub.reports.read` and for a non-member alike.
    const message = isForbidden(error)
      ? 'Anda tidak punya izin untuk melihat dashboard hub outlet ini.'
      : apiErrorMessage(error, 'Gagal memuat dashboard hub outlet.');
    return (
      <div className={cardCls}>
        <ErrorNote>{message}</ErrorNote>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cardCls}>
        <EmptyState>Belum ada data untuk outlet ini.</EmptyState>
      </div>
    );
  }

  const { sales, operational } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Penjualan Periode" value={formatCurrency(sales.total)} loading={isFetching} />
        <StatCard label="Transaksi" value={sales.transactions} loading={isFetching} />
        <StatCard label="Pajak" value={formatCurrency(sales.tax)} loading={isFetching} />
        <StatCard label="Diskon" value={formatCurrency(sales.discount)} loading={isFetching} />
      </div>

      {sales.rounding !== 0 && (
        <div className="text-sm text-gray-600">
          Pembulatan periode ini:{' '}
          <span className="font-medium text-purple-700">
            {sales.rounding > 0 ? '+' : '-'}
            {formatCurrency(Math.abs(sales.rounding))}
          </span>
        </div>
      )}

      {operational.isStale && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Outlet ini tidak punya shift buka dan aktivitas terakhirnya lebih dari {operational.staleHours} jam (atau
          belum pernah membuka shift). Periksa shift kasir outlet tersebut.
        </div>
      )}

      <div className={`${cardCls} space-y-3`}>
        <h3 className="font-semibold text-gray-900">Status Outlet</h3>
        <div className="flex items-center gap-2">
          <ShiftStatusBadge operational={operational} />
          {!data.outlet.isActive && <Badge tone="gray">nonaktif</Badge>}
        </div>
        {/* No outlet-name column here: the page header is already the outlet, and
            there is exactly one. A single-row table repeating its own title just
            pushes the shift facts off the screen. */}
        <table className="w-full">
          <tbody>
            <tr className="border-t border-gray-100">
              <td className="py-2 pr-3 text-sm text-gray-500">Tenant</td>
              <td className="py-2 text-sm text-gray-900">{data.outlet.tenantName ?? data.outlet.tenantId}</td>
            </tr>
            <tr className="border-t border-gray-100">
              <td className="py-2 pr-3 text-sm text-gray-500">Shift terakhir</td>
              <td className="py-2 text-sm text-gray-900">
                {operational.lastShiftAt ? new Date(operational.lastShiftAt).toLocaleString('id-ID') : 'belum pernah'}
                {operational.idleHours !== null && ` · ${operational.idleHours} jam lalu`}
              </td>
            </tr>
            <tr className="border-t border-gray-100">
              <td className="py-2 pr-3 text-sm text-gray-500">Anggota hub</td>
              <td className="py-2 text-sm text-gray-900">{data.members.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}