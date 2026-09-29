import { PERMISSIONS } from '@posmono/shared';

const {
  PLATFORM_HUBS_MANAGE,
  HUB_READ,
  HUB_MEMBERS_READ,
  HUB_MEMBERS_MANAGE,
  HUB_TENANTS_READ,
  HUB_TENANTS_MANAGE,
  HUB_REPORTS_READ,
  HUB_REPORTS_EXPORT,
} = PERMISSIONS;

export interface DefaultRoleDef {
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

export const OWNER_PERMS = [
  'users:read', 'users:write', 'users:delete',
  'roles:read', 'roles:write',
  'products:read', 'products:write', 'products:delete',
  'orders:read', 'orders:write', 'orders:cancel',
  'order:void', 'payment:void',
  'payments:read', 'payments:write',
  'inventory:read', 'inventory:write', 'inventory:adjust',
  'reports:read',
  'customers:read', 'customers:write',
  'settings:read', 'settings:write',
  'shifts:read', 'shifts:write',
  'printers:read', 'printers:write',
];

export const MANAGER_PERMS = [
  'products:read', 'products:write',
  'orders:read', 'orders:write', 'orders:cancel',
  'order:void', 'payment:void',
  'payments:read', 'payments:write',
  'inventory:read', 'inventory:write',
  'reports:read',
  'customers:read', 'customers:write',
  'settings:read',
  'shifts:read', 'shifts:write',
  'printers:read', 'printers:write',
];

export const CASHIER_PERMS = [
  'products:read',
  'orders:read', 'orders:write',
  'payments:read',
  'customers:read', 'customers:write',
  'shifts:read', 'shifts:write',
];

/**
 * Platform / Terminal Center super-admin (tenantId 'platform').
 * Hub & Outlet are platform-managed layers; Hub membership/consolidated
 * reporting arrives with HubMembership (Fase 9).
 *
 * Fase 16 renamed the hub permission from `hub:manage` to
 * `platform.hubs.manage`: the old string mixed a platform-level capability with
 * the `hub.*` namespace that is now reserved for hub-side admin (ADR D1 tahap 2).
 * Existing `Role` documents in MongoDB are rewritten at boot by
 * `migratePlatformHubPermissions` (see `core/platform/infrastructure/persistence`).
 */
export const PLATFORM_ROLE_PERMS = [
  PLATFORM_HUBS_MANAGE,
  'outlet:manage',
  'platform.tenants.read',
  'platform.tenants.manage',
  'platform.plans.read',
  'platform.plans.manage',
  'platform.reports.read',
  'platform.support.access',
  'platform.audit.read',
];

export const DEFAULT_PLATFORM_ROLE: DefaultRoleDef = {
  name: 'Platform Super Admin',
  description: 'Platform / Terminal Center super-admin (hub & tenant provisioning)',
  permissions: PLATFORM_ROLE_PERMS,
  isSystem: true,
};

export const PLATFORM_TENANT_ID = 'platform';

/**
 * Permissions granted to a user while acting as a hub member (cross-tenant
 * session) inside a tenant that belongs to one of their hubs.
 *
 * Fase 16: the matrix is centralised here (seedable) and extended with
 * `manager` so the role set matches `HUB_ROLE_PERMISSION_MATRIX` below.
 * Fase 17 will stop deriving cross-tenant sessions from the hub role and read
 * an explicit per-tenant grant instead — this constant stays as the fallback so
 * no existing member loses access.
 * - 'owner'  → full tenant permissions (same as the seeded Owner role)
 * - 'admin'  → daily operations management (manager-level + reports + user read)
 * - 'manager'→ daily operations management (manager-level, no user management)
 * - 'viewer' → read-only tenant visibility
 */
export const HUB_MEMBER_ROLE_PERMS: Record<string, string[]> = {
  owner: [...OWNER_PERMS],
  admin: [...MANAGER_PERMS, 'users:read', 'reports:read'],
  manager: [...MANAGER_PERMS], // already carries reports:read
  viewer: [
    'reports:read',
    'orders:read',
    'products:read',
    'customers:read',
    'inventory:read',
    'shifts:read',
    'payments:read',
  ],
};

/**
 * Hub V2 Fase 17 — roles a hub member can be *granted* per tenant.
 *
 * These are **tenant** roles (the role the user acts as inside that tenant),
 * not hub roles: a grant replaces "hub role owner ⇒ Owner penuh di semua tenant"
 * with an explicit, per-tenant decision. Keep it explicit rather than reusing
 * the hub role names so the two layers can never be confused.
 */
export const TENANT_ACCESS_ROLES = ['owner', 'admin', 'manager', 'cashier', 'viewer'] as const;
export type TenantAccessRole = (typeof TENANT_ACCESS_ROLES)[number];

export const TENANT_ACCESS_ROLE_LABELS: Record<TenantAccessRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  viewer: 'Viewer',
};

/**
 * Tenant permissions per granted role. Bundled from the seeded tenant roles so a
 * granted session carries the same permission set a real role of that name would
 * (minus `users:*` for the non-admin levels — user management stays a tenant
 * admin/owner concern, not a cross-tenant grant one).
 */
export const TENANT_ACCESS_ROLE_PERMS: Record<TenantAccessRole, string[]> = {
  owner: [...OWNER_PERMS],
  admin: [...MANAGER_PERMS, 'users:read', 'reports:read'],
  manager: [...MANAGER_PERMS], // already carries reports:read
  cashier: [...CASHIER_PERMS],
  viewer: [
    'reports:read',
    'orders:read',
    'products:read',
    'customers:read',
    'inventory:read',
    'shifts:read',
    'payments:read',
  ],
};

export const HUB_MEMBER_ROLE_LABELS: Record<string, string> = {
  owner: 'Hub Owner',
  admin: 'Hub Admin',
  manager: 'Hub Manager',
  viewer: 'Hub Viewer',
};

/**
 * Hub V2 Fase 16 — role matrix for the reserved `hub.*` namespace (ADR D1 tahap 2).
 *
 * Exported so the matrix is data, not a hardcoded chain of ternaries in the
 * service layer, and so it can be seeded once hub-side admin exists. No route
 * enforces these permissions yet: hub administration is still done from the
 * Terminal Center under `platform.hubs.manage`.
 */
export const HUB_ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  owner: [
    HUB_READ,
    HUB_MEMBERS_READ,
    HUB_MEMBERS_MANAGE,
    HUB_TENANTS_READ,
    HUB_TENANTS_MANAGE,
    HUB_REPORTS_READ,
    HUB_REPORTS_EXPORT,
  ],
  admin: [
    HUB_READ,
    HUB_MEMBERS_READ,
    HUB_MEMBERS_MANAGE,
    HUB_TENANTS_READ,
    HUB_REPORTS_READ,
    HUB_REPORTS_EXPORT,
  ],
  manager: [
    HUB_READ,
    HUB_MEMBERS_READ,
    HUB_TENANTS_READ,
    HUB_REPORTS_READ,
  ],
  viewer: [
    HUB_READ,
    HUB_REPORTS_READ,
  ],
};

export const DEFAULT_ROLES: DefaultRoleDef[] = [
  {
    name: 'Owner',
    description: 'Full access to all features',
    permissions: OWNER_PERMS,
    isSystem: true,
  },
  {
    name: 'Manager',
    description: 'Daily operations management',
    permissions: MANAGER_PERMS,
    isSystem: true,
  },
  {
    name: 'Cashier',
    description: 'Can process POS transactions',
    permissions: CASHIER_PERMS,
    isSystem: true,
  },
];
