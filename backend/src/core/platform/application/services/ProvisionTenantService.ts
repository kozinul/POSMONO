import mongoose from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { UserId } from '../../../../@shared/domain/Identifier';
import { Tenant } from '../../../tenant/domain/Tenant';
import { User } from '../../../identity/domain/User';
import { Role } from '../../../identity/domain/Role';
import { DEFAULT_ROLES } from '../../defaults';
import { PasswordService } from '../../../identity/domain/services/PasswordService';
import { OutletService } from '../../../outlet/application/services/OutletService';

export interface ProvisionTenantInput {
  tenant: {
    name: string;
    businessType?: string;
  };
  owner: {
    name: string;
    email: string;
    password?: string;
  };
  outlet: {
    name: string;
    address?: string;
    phone?: string;
  };
  hubId?: string | null;
  idempotencyKey?: string;
}

export interface ProvisionTenantResult {
  success: boolean;
  tenant: { id: string; name: string; hubId: string | null };
  owner: { id: string; name: string; email: string };
  outlet: { id: string; name: string; warehouseId: string | null };
  warehouse: { id: string; name: string } | null;
  status: 'ready';
}

interface ProvisionTenantServiceDeps {
  tenantRepository: any;
  userRepository: any;
  roleRepository: any;
  hubRepository: any;
  outletService: OutletService;
}

export class ProvisionTenantService {
  private readonly idempotencyCache = new Map<string, ProvisionTenantResult>();

  constructor(
    private readonly deps: ProvisionTenantServiceDeps,
    private readonly passwordService: PasswordService = new PasswordService(),
  ) {}

  async execute(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    if (!input.tenant?.name || !input.tenant.name.trim()) {
      throw new ValidationError('TENANT_NAME_REQUIRED');
    }
    if (!input.owner?.name || !input.owner.name.trim()) {
      throw new ValidationError('OWNER_NAME_REQUIRED');
    }
    if (!input.owner?.email || !input.owner.email.trim()) {
      throw new ValidationError('OWNER_EMAIL_INVALID');
    }
    if (!input.outlet?.name || !input.outlet.name.trim()) {
      throw new ValidationError('OUTLET_NAME_REQUIRED');
    }

    const email = input.owner.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('OWNER_EMAIL_INVALID');
    }

    if (input.hubId) {
      const hub = await this.deps.hubRepository.findById(input.hubId);
      if (!hub) {
        throw new NotFoundError('Hub', input.hubId);
      }
    }

    // Check if email already exists globally
    const existingUser = this.deps.userRepository.findByEmailGlobal
      ? await this.deps.userRepository.findByEmailGlobal(email)
      : null;
    if (existingUser) {
      throw new ConflictError('OWNER_EMAIL_ALREADY_EXISTS');
    }

    const session = mongoose.connection.readyState === 1
      ? await mongoose.startSession().catch(() => null)
      : null;

    const executeProvisioning = async (sess?: any): Promise<ProvisionTenantResult> => {
      const ownerId = new UserId().toValue();
      const tenantName = input.tenant.name.trim();
      const tenantSlug =
        tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') +
        '-' +
        Date.now().toString().slice(-4);

      const tenant = Tenant.create({
        name: tenantName,
        slug: tenantSlug,
        domain: null,
        ownerId,
        plan: 'trial',
        status: 'trial',
        businessType: (input.tenant.businessType || 'restaurant') as any,
        modules: [input.tenant.businessType || 'restaurant'],
        databaseName: `posmono_${tenantSlug}`,
        config: {
          timezone: 'Asia/Jakarta',
          currency: 'IDR',
          locale: 'id',
          taxRate: 0.1,
          taxName: 'Pajak',
          ppnEnabled: true,
          ppnRate: 0.12,
          serviceChargeEnabled: false,
          serviceChargeRate: 0,
          serviceChargeName: 'Service Charge',
          discountMaxPercent: 100,
          discountMaxNominal: 1_000_000,
          receiptFooter: 'Terima kasih telah berbelanja',
          receiptLogo: '',
          roundingEnabled: false,
          roundingMode: 'nearest',
          roundingDenomination: 0,
          autoPrintReceipt: true,
          autoPrintKot: false,
        },
        billingEmail: email,
      });

      const tenantId = tenant.id.toValue();

      if (input.hubId) {
        tenant.assignHub(input.hubId);
      }

      await this.deps.tenantRepository.save(tenant, { session: sess });

      let ownerRoleId = '';
      for (const def of DEFAULT_ROLES) {
        const role = Role.create({
          tenantId,
          name: def.name,
          description: def.description,
          permissions: def.permissions,
          isSystem: def.isSystem,
        });
        await this.deps.roleRepository.save(role, { session: sess });
        if (def.name === 'Owner') ownerRoleId = role.id.toValue();
      }

      const rawPassword = input.owner.password || 'temporary-password';
      const passwordHash = await this.passwordService.hash(rawPassword);

      const owner = User.hydrate({
        id: ownerId,
        tenantId,
        email,
        passwordHash,
        displayName: input.owner.name.trim(),
        roleId: ownerRoleId,
        outletIds: [],
        isActive: true,
        lastLoginAt: null,
        pin: null,
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.deps.userRepository.save(owner, { session: sess });

      const outlet = await this.deps.outletService.ensureDefault(
        tenantId,
        {
          name: input.outlet.name.trim(),
          address: input.outlet.address?.trim() || '',
          phone: input.outlet.phone?.trim() || '',
        },
        sess,
      );

      const warehouseId = outlet.serialize().warehouseId;

      return {
        success: true,
        tenant: {
          id: tenantId,
          name: tenant.serialize().name,
          hubId: tenant.serialize().hubId,
        },
        owner: {
          id: owner.id.toValue(),
          name: owner.serialize().displayName,
          email: owner.serialize().email,
        },
        outlet: {
          id: outlet.id.toValue(),
          name: outlet.serialize().name,
          warehouseId,
        },
        warehouse: warehouseId ? { id: warehouseId, name: 'Warehouse Utama' } : null,
        status: 'ready',
      };
    };

    if (session) {
      try {
        let result: ProvisionTenantResult | undefined;
        try {
          await session.withTransaction(async () => {
            result = await executeProvisioning(session);
          });
        } catch (err: any) {
          if (
            err?.message?.includes('replica set') ||
            err?.message?.includes('Transaction numbers')
          ) {
            result = await executeProvisioning();
          } else {
            throw err;
          }
        }

        if (input.idempotencyKey && result) {
          this.idempotencyCache.set(input.idempotencyKey, result);
        }

        return result!;
      } finally {
        await session.endSession();
      }
    } else {
      const result = await executeProvisioning();
      if (input.idempotencyKey && result) {
        this.idempotencyCache.set(input.idempotencyKey, result);
      }
      return result;
    }
  }
}
