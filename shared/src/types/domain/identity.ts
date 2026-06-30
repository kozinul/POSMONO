export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roleId: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
}

export interface Permission {
  code: string;
  name: string;
  description: string;
  module: string;
}
