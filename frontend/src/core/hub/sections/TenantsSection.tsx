import { Badge, EmptyState, ErrorNote, cardCls } from '../../platform/components/platformUi';
import type { MyHubTenant } from '../../../@shared/hooks/useMyHub';

/**
 * Fase 24 — the tenant list a member is allowed to see, and nothing else.
 *
 * Read-only by design: pause, resume and subscription moves stay in the Terminal
 * Center, where platform operators can see the consequences. This view is
 * projected server-side (`MyHubController.tenantRows`), so nothing to filter out
 * here — and nothing extra to leak if the projection ever widens.
 */
export default function TenantsSection({
  tenants,
  isLoading,
  error,
}: {
  tenants: MyHubTenant[];
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) return <div className="text-sm text-gray-500">Memuat tenant...</div>;
  if (error) {
    return (
      <ErrorNote>
        {error instanceof Error ? error.message : 'Gagal memuat daftar tenant hub.'}
      </ErrorNote>
    );
  }
  if (tenants.length === 0) {
    return (
      <div className={cardCls}>
        <EmptyState>Belum ada tenant yang bergabung dengan hub ini.</EmptyState>
      </div>
    );
  }

  const GRACE_D_MS = 7 * 24 * 60 * 60 * 1000;
  const expiring = tenants.filter((t) => {
    // Non-active status counts on its own, even without an expiry to read.
    if (t.status !== 'active' && t.status !== 'trial') return true;
    if (!t.subscriptionExpiresAt) return false;
    const left = new Date(t.subscriptionExpiresAt).getTime() - Date.now();
    return left <= GRACE_D_MS;
  });

  return (
    <div className="space-y-3">
      {expiring.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          {expiring.length} tenant dalam hub berada di ambang masa aktif berakhir atau berstatus
          nonaktif — tinjau di Terminal Center.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Tenant</th>
            <th className="px-4 py-3">Jenis usaha</th>
            <th className="px-4 py-3">Kontak</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenants.map((tenant) => (
            <tr key={tenant.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{tenant.name}</div>
                {tenant.address && <div className="text-xs text-gray-500">{tenant.address}</div>}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {tenant.businessType || tenant.businessCategory || '-'}
              </td>
              <td className="px-4 py-3 text-gray-600">
                <div>{tenant.phone || '-'}</div>
                {tenant.subscriptionExpiresAt && (
                  <div className="text-xs text-gray-500">
                    Berlaku s/d {new Date(tenant.subscriptionExpiresAt).toLocaleDateString('id-ID')}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {tenant.status === 'active' ? (
                  <Badge tone="green">Aktif</Badge>
                ) : (
                  <Badge tone="red">Nonaktif</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
