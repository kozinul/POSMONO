/**
 * Single source of truth for "may this session enter this tenant?" — consumed
 * by the login/switch gate (`AuthService.assertTenantUsable`) and the tenant
 * switcher (`HubMemberAccessService.findAccessibleTenants`), so the list never
 * offers a tenant the gate would 403 (Fase 17: hide instead of 403-on-click).
 *
 * Structural on purpose: `AuthService` deliberately depends on a minimal view
 * of the tenant document, not the domain class.
 */

/** Why entering the tenant is refused. `null` = allowed. */
export type TenantEntryDenial = 'suspended' | 'status' | 'expired';

/** Human-readable Indonesian label per non-active status (lowercase, for
 * "berstatus …" phrasing). Shared by the login/switch gate and the POS
 * transaction gate so both say the same word. */
export const TENANT_STATUS_LABELS: Record<string, string> = {
  suspended: 'ditangguhkan',
  frozen: 'dibekukan',
  cancelled: 'dibatalkan',
  deactivated: 'dinonaktifkan',
};

export interface TenantEntryRecord {
  isActive?(): boolean;
  isExpired?(): boolean;
  serialize?(): { status?: string | null };
}

/**
 * Owner gets grace on `suspended` and `expired` (billing recovery can only be
 * done from inside); every other non-active status blocks everyone. A missing
 * document (or a stub without `isActive`) never blocks — the platform super
 * admin has no `tenants` row, and a data glitch must not lock everyone out.
 */
export function tenantEntryDenial(
  tenant: TenantEntryRecord | null | undefined,
  isOwner: boolean,
): TenantEntryDenial | null {
  if (!tenant || typeof tenant.isActive !== 'function') return null;

  if (!tenant.isActive()) {
    const status = String(tenant.serialize?.()?.status ?? '');
    if (status === 'suspended') return isOwner ? null : 'suspended';
    return 'status';
  }

  if (typeof tenant.isExpired === 'function' && tenant.isExpired()) {
    return isOwner ? null : 'expired';
  }

  return null;
}
