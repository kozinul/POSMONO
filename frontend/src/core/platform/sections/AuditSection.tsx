import { useState } from 'react';
import { usePlatformAudit, usePlatformProvisioningRuns } from '../../../@shared/hooks/usePlatform';
import { Loading, cardCls, inputCls } from '../components/platformUi';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  TENANT_CREATED: 'Tenant Dibuat',
  TENANT_UPDATED: 'Tenant Diperbarui',
  TENANT_STATUS_CHANGED: 'Status Tenant Diubah',
  TENANT_FROZEN: 'Tenant Dibekukan',
  TENANT_SUSPENDED: 'Tenant Di-Suspend',
  TENANT_DEACTIVATED: 'Tenant Dinonaktifkan',
  SUBSCRIPTION_EXTENDED: 'Langganan Diperpanjang',
  PLAN_ASSIGNED: 'Plan Di-assign',
  PLAN_CHANGED: 'Plan Diubah',
  PLAN_CANCELLED: 'Plan Dibatalkan',
  OUTLET_CREATED: 'Outlet Dibuat',
  OUTLET_UPDATED: 'Outlet Diperbarui',
  HUB_CREATED: 'Hub Dibuat',
  HUB_UPDATED: 'Hub Diperbarui',
  HUB_DELETED: 'Hub Dihapus',
  TENANT_ASSIGNED_TO_HUB: 'Tenant Masuk Hub',
  TENANT_REMOVED_FROM_HUB: 'Tenant Keluar Hub',
  MEMBER_ADDED: 'Anggota Ditambahkan',
  MEMBER_ROLE_CHANGED: 'Role Anggota Diubah',
  MEMBER_REMOVED: 'Anggota Dihapus',
};

const AUDIT_ACTION_BADGE: Record<string, string> = {
  TENANT_CREATED: 'bg-green-100 text-green-700',
  TENANT_FROZEN: 'bg-blue-100 text-blue-700',
  TENANT_SUSPENDED: 'bg-red-100 text-red-700',
  TENANT_DEACTIVATED: 'bg-red-100 text-red-700',
  PLAN_CANCELLED: 'bg-red-100 text-red-700',
  HUB_DELETED: 'bg-red-100 text-red-700',
  MEMBER_REMOVED: 'bg-red-100 text-red-700',
};

export default function AuditSection({ action, onActionChange }: { action: string; onActionChange: (action: string) => void }) {
  const [page, setPage] = useState(1);
  const setAction = (next: string) => {
    onActionChange(next);
    setPage(1);
  };
  const { data, isLoading } = usePlatformAudit({ action: action || undefined, page, limit: 30, enabled: true });
  const { data: runs } = usePlatformProvisioningRuns({ limit: 5, enabled: true });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 30)));

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-center">
        <select
          className={inputCls + ' w-64'}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter aksi audit"
        >
          <option value="">— Semua Aksi —</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className={cardCls}>
        {isLoading ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Belum ada aktivitas tercatat.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aktor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.occurredAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${AUDIT_ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 max-w-md">{log.description}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {log.actorEmail || log.actorRole}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {log.tenantId ? <span className="font-mono text-[10px]">{log.tenantId.slice(0, 8)}…</span> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-gray-500">Total {data.total} aktivitas</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-gray-300 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                ← Sebelumnya
              </button>
              <span className="px-2 py-1 text-xs text-gray-500">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-gray-300 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="cardCls">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Provisi Tenant Terbaru</h3>
        {!runs || runs.data.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada riwayat provisioning.</p>
        ) : (
          <div className="space-y-2">
            {runs.data.map((run) => (
              <div key={run.id} className="border rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${run.overallStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {run.overallStatus}
                    </span>
                    <span className="text-sm text-gray-700">{run.tenantName}</span>
                    <span className="text-xs text-gray-400">{run.ownerEmail}</span>
                    <span className="text-xs text-gray-400">(~{(run.durationMs / 1000).toFixed(1)}s)</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(run.createdAt).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {run.steps.map((s, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      s.status === 'success' ? 'bg-green-50 text-green-700' :
                      s.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
                    }`}>{s.step}</span>
                  ))}
                </div>
                {run.error && <p className="text-xs text-red-600 mt-1">{run.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

