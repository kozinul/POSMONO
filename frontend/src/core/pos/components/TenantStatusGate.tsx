import { useTenant, type Tenant } from '../../../@shared/hooks/useTenant';

const STATUS_LABELS: Record<string, string> = {
  suspended: 'Ditangguhkan',
  frozen: 'Dibekukan',
  cancelled: 'Dibatalkan',
  deactivated: 'Dinonaktifkan',
};

export interface TenantBlock {
  label: string;
  message: string;
}

/**
 * Client mirror of the server gate (`tenantEntryDenial` with no owner grace):
 * a non-active status always blocks, an expired period blocks even while the
 * status still reads `active` (the sweep has not run yet). Missing tenant or
 * no expiry (platform) never blocks.
 */
export function tenantBlock(tenant?: Tenant | null): TenantBlock | null {
  if (!tenant) return null;

  const isActiveStatus = tenant.status === 'active' || tenant.status === 'trial';
  if (!isActiveStatus) {
    const label = STATUS_LABELS[tenant.status] ?? 'Nonaktif';
    return {
      label,
      message: `Toko Anda berstatus ${label.toLowerCase()} — transaksi tidak dapat dilakukan. Hubungi pengelola untuk mengaktifkan kembali.`,
    };
  }

  if (tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt).getTime() <= Date.now()) {
    return {
      label: 'Masa Aktif Berakhir',
      message:
        'Masa aktif toko Anda telah berakhir — transaksi tidak dapat dilakukan. Hubungi pengelola untuk memperpanjang.',
    };
  }

  return null;
}

/**
 * Non-dismissible full-screen refusal on the POS: the cashier sees why
 * transacting is refused and cannot close it — it clears only when a refetch
 * shows the tenant usable again (30s poll while blocked, plus the manual
 * button). Reads stay open on the server precisely so this screen can load.
 */
export function TenantStatusGate() {
  const { data: tenant, refetch, isPending } = useTenant({
    refetchInterval: (query) => (tenantBlock(query.state.data) ? 30_000 : false),
  });

  const block = tenantBlock(tenant);
  if (isPending || !block) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Transaksi dinonaktifkan"
      className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-7 w-7 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>
        <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
          {block.label}
        </span>
        <h2 className="mt-3 text-lg font-bold text-gray-900">Transaksi Dinonaktifkan</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{block.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Periksa Ulang
        </button>
        <p className="mt-3 text-xs text-gray-400">
          Layar ini tidak dapat ditutup sampai status toko aktif kembali.
        </p>
      </div>
    </div>
  );
}
