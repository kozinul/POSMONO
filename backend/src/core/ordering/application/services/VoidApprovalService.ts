import { ForbiddenError } from '../../../../@shared/infrastructure/error/AppError';
import { PasswordService } from '../../../identity/domain/services/PasswordService';

export const VOID_ORDER_PERMISSION = 'order:void';
export const VOID_PAYMENT_PERMISSION = 'payment:void';

export interface VoidApprovalResolution {
  approverId: string;
  approverName: string;
  requireApproval: boolean;
}

interface VerifyApproverInput {
  tenantId: string;
  userId: string;
  managerPin?: string;
  requiredPermission: string;
}

export class VoidApprovalService {
  constructor(
    private readonly userRepository: any,
    private readonly roleRepository: any,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Approval policy untuk void (same-terminal flow).
   * - Caller dengan permission `requiredPermission` (mis. order:void) → self-approve, tanpa PIN.
   * - Caller lain (cashier) → wajib `managerPin` milik user yang punya permission tsb.
   */
  async verifyApprover(input: VerifyApproverInput): Promise<VoidApprovalResolution> {
    const caller = await this.userRepository.findByIdAndTenant(input.userId, input.tenantId);
    if (!caller) {
      throw new ForbiddenError('User not found');
    }

    if (await this.userHasPermission(input.tenantId, caller.roleIdValue, input.requiredPermission)) {
      return {
        approverId: caller.id.toValue(),
        approverName: caller.displayNameValue,
        requireApproval: false,
      };
    }

    if (!input.managerPin) {
      throw new ForbiddenError('Void memerlukan PIN manajer untuk persetujuan');
    }

    const approver = await this.findApproverByPin(input.tenantId, input.managerPin, input.requiredPermission);
    if (!approver) {
      throw new ForbiddenError('PIN manajer salah');
    }

    return {
      approverId: approver.user.id.toValue(),
      approverName: approver.user.displayNameValue,
      requireApproval: true,
    };
  }

  private async userHasPermission(tenantId: string, roleId: string, permission: string): Promise<boolean> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) return false;
    if (role.serialize().tenantId !== tenantId) return false;
    return role.serialize().permissions.includes(permission);
  }

  private async findApproverByPin(
    tenantId: string,
    managerPin: string,
    requiredPermission: string,
  ): Promise<{ user: any } | null> {
    const users = await this.userRepository.findByTenant(tenantId);
    const candidates = users.filter((u: any) => u.pinValue);

    for (const user of candidates) {
      const match = await this.passwordService.compare(managerPin, user.pinValue);
      if (!match) continue;

      const hasPermission = await this.userHasPermission(tenantId, user.roleIdValue, requiredPermission);
      if (hasPermission) {
        return { user };
      }
    }

    return null;
  }
}
