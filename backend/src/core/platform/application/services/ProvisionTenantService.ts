import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ConflictError, NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { UserId } from '../../../../@shared/domain/Identifier';
import { Tenant } from '../../../tenant/domain/Tenant';
import { User } from '../../../identity/domain/User';
import { Role } from '../../../identity/domain/Role';
import { DEFAULT_ROLES, DEFAULT_TEMPLATES } from '../../defaults';
import { PasswordService } from '../../../identity/domain/services/PasswordService';
import { OutletService } from '../../../outlet/application/services/OutletService';
import {
  ProvisioningRun,
  IProvisioningStep,
} from '../../provisioning/domain/ProvisioningRun';
import { MongoProvisioningRunRepository } from '../../provisioning/infrastructure/persistence/MongoProvisioningRunRepository';

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
  templates: number;
  status: 'ready';
}

interface ProvisionTenantServiceDeps {
  tenantRepository: any;
  userRepository: any;
  roleRepository: any;
  hubRepository: any;
  outletService: OutletService;
  templateService: any;
  provisioningRunRepository?: MongoProvisioningRunRepository;
}

export class ProvisionTenantService {
  constructor(
    private readonly deps: ProvisionTenantServiceDeps,
    private readonly passwordService: PasswordService = new PasswordService(),
  ) {}

  async execute(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
    if (input.idempotencyKey) {
      const existing = await this.deps.provisioningRunRepository?.findByIdempotencyKey(input.idempotencyKey);
      if (existing && existing.serialize().result) {
        return existing.serialize().result as unknown as ProvisionTenantResult;
      }
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

    const requestId = uuidv4();
    const steps: IProvisioningStep[] = [];
    const startedAt = Date.now();

    const session = mongoose.connection.readyState === 1
      ? await mongoose.startSession().catch(() => null)
      : null;

    const run = ProvisioningRun.create({
      requestId,
      idempotencyKey: input.idempotencyKey ?? null,
      tenantName: input.tenant.name.trim(),
      ownerEmail: email,
      hubId: input.hubId ?? null,
      mode: input.hubId ? 'hub' : 'standalone',
      steps,
      overallStatus: 'failed',
      durationMs: 0,
      rolledBack: false,
      tenantId: null,
      result: null,
      error: null,
    });

    const executeProvisioning = async (sess?: any): Promise<ProvisionTenantResult> => {
      steps.length = 0;
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

      run.addStep('tenant', 'success', `Tenant "${tenantName}" dibuat`);
      const t0 = Date.now();
      await this.deps.tenantRepository.save(tenant, { session: sess });
      run.markStepDuration(steps.length - 1, Date.now() - t0);

      let ownerRoleId = '';
      run.addStep('roles', 'success', 'Role sistem dibuat (Owner/Manager/Cashier)');
      const t1 = Date.now();
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
      run.markStepDuration(steps.length - 1, Date.now() - t1);

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

      run.addStep('owner', 'success', `Owner "${input.owner.name.trim()}" dibuat`);
      const t2 = Date.now();
      await this.deps.userRepository.save(owner, { session: sess });
      run.markStepDuration(steps.length - 1, Date.now() - t2);

      run.addStep('outlet', 'success', `Outlet "${input.outlet.name.trim()}" dibuat`);
      const t3 = Date.now();
      const outlet = await this.deps.outletService.ensureDefault(
        tenantId,
        {
          name: input.outlet.name.trim(),
          address: input.outlet.address?.trim() || '',
          phone: input.outlet.phone?.trim() || '',
        },
        sess,
      );
      run.markStepDuration(steps.length - 1, Date.now() - t3);

      const warehouseId = outlet.serialize().warehouseId;
      if (warehouseId) {
        run.addStep('warehouse', 'success', 'Warehouse Utama dibuat');
      }

      let templateCount = 0;
      if (this.deps.templateService) {
        run.addStep('templates', 'success', 'Template dokumen default disalin');
        const t4 = Date.now();
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
        run.markStepDuration(steps.length - 1, Date.now() - t4);
      }

      run.addStep('subscription', 'skipped', 'Trial — assign plan via Terminal Center');

      run.setTenantId(tenantId);

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
        templates: templateCount,
        status: 'ready',
      };
    };

    const persistResult = async (result: ProvisionTenantResult): Promise<void> => {
      run.markCompleted(false);
      run.setDurationMs(Date.now() - startedAt);
      run.setResult(result as unknown as Record<string, unknown>);
      await this.deps.provisioningRunRepository?.save(run);
    };

    const persistFailure = async (error: unknown): Promise<void> => {
      const message = error instanceof Error ? error.message : String(error);
      run.setDurationMs(Date.now() - startedAt);
      run.markFailed(message, true);
      await this.deps.provisioningRunRepository?.save(run);
    };

    try {
      let result: ProvisionTenantResult | undefined;
      try {
        if (session) {
          await session.withTransaction(async () => {
            result = await executeProvisioning(session);
          });
        } else {
          result = await executeProvisioning();
        }
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

      await persistResult(result!);
      return result!;
    } catch (err) {
      await persistFailure(err);
      throw err;
    } finally {
      if (session) {
        await session.endSession().catch(() => undefined);
      }
    }
  }
}