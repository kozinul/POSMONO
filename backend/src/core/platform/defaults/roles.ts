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
 */
export const PLATFORM_ROLE_PERMS = [
  'hub:manage',
  'outlet:manage',
  'platform.tenants.read',
  'platform.tenants.manage',
  'platform.plans.read',
  'platform.plans.manage',
  'platform.reports.read',
  'platform.support.access',
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
 * - 'owner'  → full tenant permissions (same as the seeded Owner role)
 * - 'admin'  → daily operations management (manager-level + reports)
 * - 'viewer' → read-only tenant visibility
 */
export const HUB_MEMBER_ROLE_PERMS: Record<string, string[]> = {
  owner: [...OWNER_PERMS],
  admin: [...MANAGER_PERMS, 'users:read', 'reports:read'],
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
  viewer: 'Hub Viewer',
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
