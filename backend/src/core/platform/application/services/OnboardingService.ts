import { NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Role } from '../../../identity/domain/Role';
import { User } from '../../../identity/domain/User';
import { PaymentMethod } from '../../../payment/domain/PaymentMethod';
import { DEFAULT_ROLES, DEFAULT_TEMPLATES, DEFAULT_PAYMENT_METHODS } from '../../defaults';

export interface OwnerProvision {
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface OnboardingServiceDeps {
  tenantRepository: any;
  roleRepository: any;
  userRepository: any;
  paymentMethodRepository: any;
  warehouseService: any;
  templateService: any;
}

export interface ProvisionResult {
  tenantId: string;
  roles: string[];
  ownerUserId: string | null;
  templates: number;
  paymentMethods: number;
  warehouseId: string | null;
  wasProvisioned: boolean;
}

/**
 * Provisioning infrastruktur baseline sebuah tenant yang baru dibuat:
 * system roles, owner user, template dokumen default, payment methods,
 * dan warehouse utama. Idempotent — aman dipanggil ulang.
 *
 * Titik sambung Hub/Outlet masa depan: buat Outlet Utama + Warehouse 1:1 di sini.
 */
export class OnboardingService {
  constructor(private readonly deps: OnboardingServiceDeps) {}

  async provision(tenantId: string, owner?: OwnerProvision): Promise<ProvisionResult> {
    const tenant = await this.deps.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    const existingRoles = await this.deps.roleRepository.findByTenant(tenantId);
    const hasInfrastructure = existingRoles.length > 0;
    if (hasInfrastructure) {
      return {
        tenantId,
        roles: existingRoles.map((r: Role) => r.serialize().name),
        ownerUserId: tenant.serialize().ownerId ?? null,
        templates: 0,
        paymentMethods: 0,
        warehouseId: null,
        wasProvisioned: false,
      };
    }

    let ownerRoleId: string | null = null;
    const roleNames: string[] = [];

    for (const def of DEFAULT_ROLES) {
      const role = Role.create({
        tenantId,
        name: def.name,
        description: def.description,
        permissions: def.permissions,
        isSystem: def.isSystem,
      });
      await this.deps.roleRepository.save(role);
      roleNames.push(def.name);
      if (def.name === 'Owner') ownerRoleId = role.id.toValue();
    }

    let ownerUserId: string | null = tenant.serialize().ownerId ?? null;
    if (owner && ownerRoleId) {
      const existing = tenant.serialize().ownerId
        ? await this.deps.userRepository.findByIdAndTenant(tenant.serialize().ownerId, tenantId)
        : null;
      if (existing) {
        ownerUserId = existing.id.toValue();
      } else {
        const user = User.create({
          tenantId,
          email: owner.email,
          passwordHash: owner.passwordHash,
          displayName: owner.displayName,
          roleId: ownerRoleId,
          outletIds: [],
          isActive: true,
          lastLoginAt: null,
          pin: null,
          preferences: {},
        });
        await this.deps.userRepository.save(user);
        ownerUserId = user.id.toValue();
      }
    }

    let templateCount = 0;
    for (const def of DEFAULT_TEMPLATES) {
      await this.deps.templateService.create({
        tenantId,
        name: def.name,
        description: def.description,
        documentType: def.documentType,
        paper: def.paper,
        sections: def.sections,
        isDefault: def.isDefault,
      });
      templateCount += 1;
    }

    let paymentMethodCount = 0;
    for (const def of DEFAULT_PAYMENT_METHODS) {
      const method = PaymentMethod.create({
        tenantId,
        name: def.name,
        code: def.code,
        description: def.description,
        icon: def.icon,
        color: def.color,
        sortOrder: def.sortOrder,
        isActive: true,
        requiresReference: def.requiresReference,
        config: def.config,
      });
      await this.deps.paymentMethodRepository.save(method);
      paymentMethodCount += 1;
    }

    let warehouseId: string | null = null;
    const warehouses = await this.deps.warehouseService.list(tenantId);
    if (warehouses.length === 0) {
      const warehouse = await this.deps.warehouseService.create({ tenantId, name: 'Utama' });
      warehouseId = warehouse.id.toValue();
    } else {
      warehouseId = warehouses[0].id.toValue();
    }

    return {
      tenantId,
      roles: roleNames,
      ownerUserId,
      templates: templateCount,
      paymentMethods: paymentMethodCount,
      warehouseId,
      wasProvisioned: true,
    };
  }
}
