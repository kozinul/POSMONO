import { Hub, HUB_STATUSES, type HubStatus } from '../../src/core/hub/domain/Hub';
import { normalizeHubCode } from '../../src/core/hub/domain/hubCode';

/**
 * Hub fixtures for tests.
 *
 * Hubs are built with explicit `code`/`status` (Fase 18) rather than through the
 * legacy `isActive` flag, so a test that wants a suspended hub says so directly.
 * `code` defaults to the code the name would normalise to — the same thing
 * `HubService.create` does — which keeps two differently named hubs from
 * colliding on the unique `code` index.
 */
export function makeHub(
  overrides: Partial<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: HubStatus;
    ownerUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  const id = overrides.id ?? 'hub-1';
  const name = overrides.name ?? 'BCA Hospitality';
  return Hub.hydrate({
    id,
    // Same fallback as the repository: a name with no usable characters gets an
    // id-based code rather than `''`, which two hubs could not both store.
    code: overrides.code ?? (normalizeHubCode(name) || normalizeHubCode(`HUB-${id}`) || id),
    name,
    description: overrides.description ?? null,
    status: overrides.status ?? 'active',
    ownerUserId: overrides.ownerUserId ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  });
}

export { HUB_STATUSES };
export type { HubStatus };