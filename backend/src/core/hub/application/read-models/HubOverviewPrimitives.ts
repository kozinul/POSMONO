/**
 * Shared primitives for the two hub overview read views.
 *
 * Fase 19 built one read model (`HubOverviewReadModel`) for the group view, and
 * Fase 23 added a second, narrower one (`HubOutletOverviewReadModel`) for a
 * single outlet. They are deliberately **two views, not one function with
 * filters**: a hub member asking "how is this group of businesses doing" and an
 * operator asking "how is this one outlet doing" are different questions, and a
 * `getOverview({ hubId?, outletId?, tenantId? })` signature would only hide that.
 *
 * What genuinely belongs to both lives here, so there is exactly one owner:
 *
 * - `buildOutletRows` — which outlets appear, and when one counts as stale. Fase
 *   19 already learned this the hard way: two implementations of the stale rule
 *   is how a rule quietly starts disagreeing with itself.
 * - `countHubMembers` — the `countMembers` head count with the `listMembers`
 *   fallback, i.e. the rule that keeps the member card off the N+1 path.
 *
 * Neither view imports the other, and neither imports a concrete service: the
 * sources stay structural so a test can pass doubles without MongoDB.
 */

/** Outlets with no open shift and no activity within `staleHours` need a look. */
export const OVERVIEW_STALE_HOURS = 24;

const MS_PER_HOUR = 60 * 60 * 1000;

export interface HubOverviewOutletDocument {
  id: string;
  name: string;
  tenantId: string;
  isActive: boolean;
}

export interface HubOverviewActivityRow {
  tenantId: string;
  outletId: string | null;
  openShifts: number;
  hasOpenShift: boolean;
  lastShiftAt: string | null;
}

export interface HubOverviewOutletRow {
  outletId: string | null;
  outletName: string | null;
  tenantId: string;
  tenantName: string | null;
  isActive: boolean;
  openShifts: number;
  lastShiftAt: string | null;
  hasOpenShift: boolean;
  isStale: boolean;
  idleHours: number | null;
}

/** Key that joins shift activity to an outlet; `null` outlet = the tenant default outlet. */
export function outletKey(tenantId: string, outletId: string | null): string {
  return `${tenantId}:${outletId ?? 'default'}`;
}

/**
 * The single owner of the outlet list and the stale rule.
 *
 * Rows are driven by the outlet documents, not by shift activity, so an outlet
 * that has never opened a shift is visible instead of silently absent — and then
 * activity for an outlet with no document (deleted outlet, or a legacy
 * outletId-less shift) is added back, otherwise a live cashier disappears.
 *
 * `staleHours` is deliberately **not** a parameter: both views must agree on what
 * "stale" means, and a knob here would be one caller drifting away from the other.
 */
export function buildOutletRows(input: {
  outletDocuments: HubOverviewOutletDocument[];
  activityRows: HubOverviewActivityRow[];
  tenantNameById: Record<string, string>;
  /** Injected in tests to keep the 24-hour rule from making assertions age-dependent. */
  now?: Date;
}): HubOverviewOutletRow[] {
  const { outletDocuments, activityRows, tenantNameById } = input;
  const nowMs = (input.now ?? new Date()).getTime();
  const staleMs = OVERVIEW_STALE_HOURS * MS_PER_HOUR;

  const activityByKey: Record<string, HubOverviewActivityRow> = {};
  for (const row of activityRows) {
    activityByKey[outletKey(row.tenantId, row.outletId)] = row;
  }

  const rows: HubOverviewOutletRow[] = [];
  const pushRow = (base: {
    outletId: string | null;
    outletName: string | null;
    tenantId: string;
    isActive: boolean;
  }): void => {
    const activityRow = activityByKey[outletKey(base.tenantId, base.outletId)];
    const hasOpenShift = activityRow?.hasOpenShift ?? false;
    const lastShiftAt = activityRow?.lastShiftAt ?? null;
    const idleMs = lastShiftAt ? nowMs - new Date(lastShiftAt).getTime() : null;
    rows.push({
      ...base,
      tenantName: tenantNameById[base.tenantId] ?? null,
      openShifts: activityRow?.openShifts ?? 0,
      lastShiftAt,
      hasOpenShift,
      // An outlet that never opened a shift is stale too: that is exactly the
      // case an operator needs to see, and it produces no shift row at all.
      isStale: !hasOpenShift && (idleMs === null || idleMs > staleMs),
      idleHours: idleMs === null ? null : Math.floor(idleMs / MS_PER_HOUR),
    });
  };

  for (const outlet of outletDocuments) {
    pushRow({
      outletId: outlet.id,
      outletName: outlet.name,
      tenantId: outlet.tenantId,
      isActive: outlet.isActive,
    });
  }

  const knownOutletIds = new Set(outletDocuments.map((o) => o.id));
  for (const activityRow of activityRows) {
    if (activityRow.outletId && knownOutletIds.has(activityRow.outletId)) continue;
    pushRow({
      outletId: activityRow.outletId,
      outletName: null,
      tenantId: activityRow.tenantId,
      isActive: activityRow.outletId === null,
    });
  }

  rows.sort(
    (a, b) =>
      Number(b.hasOpenShift) - Number(a.hasOpenShift) ||
      (a.outletName ?? '').localeCompare(b.outletName ?? ''),
  );

  return rows;
}

export interface HubMemberCountSource {
  listMembers(hubId: string): Promise<unknown[]>;
  countMembers?(hubId: string): Promise<number>;
}

/**
 * `countMembers` when the source has it, `listMembers().length` otherwise.
 *
 * The fallback is why Fase 21 wired the platform half to a member source that
 * only decorates rows: dropping it would silently reintroduce the N+1
 * `findById`-per-member that `countByHub` was added to remove.
 */
export async function countHubMembers(
  source: HubMemberCountSource | null,
  hubId: string,
): Promise<number> {
  if (!source) return 0;
  if (source.countMembers) return source.countMembers(hubId);
  return (await source.listMembers(hubId)).length;
}
