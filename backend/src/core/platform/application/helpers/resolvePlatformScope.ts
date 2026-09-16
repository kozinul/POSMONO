export interface PlatformScope {
  tenantIds: string[];
  tenantNameById: Record<string, string>;
}

/**
 * Resolve which tenants fall into a Terminal Center scope:
 * - `tenantId` given → just that tenant (empty when not found)
 * - `hubId` given → every tenant assigned to the hub
 * - neither → every tenant
 */
export async function resolvePlatformScope(
  tenantRepository: any,
  options: { hubId?: string; tenantId?: string },
): Promise<PlatformScope> {
  let tenants: any[];
  if (options.tenantId) {
    const tenant = await tenantRepository.findById(options.tenantId);
    tenants = tenant ? [tenant] : [];
  } else if (options.hubId) {
    tenants = await tenantRepository.findByHubId(options.hubId);
  } else {
    tenants = await tenantRepository.findAll();
  }

  const tenantNameById: Record<string, string> = {};
  for (const tenant of tenants) {
    const data = tenant.serialize();
    tenantNameById[data.id] = data.name;
  }

  return {
    tenantIds: tenants.map((t) => t.serialize().id),
    tenantNameById,
  };
}