import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../@shared/infrastructure/error/AppError';
import {
  HubInvitation,
  HUB_INVITATION_DEFAULT_TTL_HOURS,
  HUB_INVITATION_MAX_TTL_HOURS,
  HUB_INVITATION_MIN_TTL_HOURS,
  isValidInvitationEmail,
  normalizeInvitationEmail,
  type IHubInvitation,
  type HubInvitationStatus,
} from '../../domain/HubInvitation';
import type { HubInvitationRepository } from '../../domain/HubInvitationRepository';
import { generateInvitationToken, hashInvitationToken } from '../../domain/invitationToken';
import { HUB_MEMBER_ROLES, type HubMemberRole } from '../../domain/HubMembership';
import type { HubRepository } from '../../domain/HubRepository';
import type { Hub } from '../../domain/Hub';
import { HUB_MEMBER_ROLE_LABELS } from '../../../platform/defaults/roles';

/** Only what the invitation flow needs from the identity repository. */
interface HubInvitationUserLike {
  id: { toValue(): string };
  emailValue: string;
}
interface HubInvitationUserSource {
  findByIdRaw(id: string): Promise<HubInvitationUserLike | null>;
  findByEmailGlobal(email: string): Promise<HubInvitationUserLike | null>;
}
interface HubMembershipView {
  id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
}
/** The membership lifecycle, so accepting reuses the same path as adding a member
 *  (role validation, archived-hub guard, and the ADR D3 grant baseline). */
interface HubMembershipWriter {
  addMembership(hubId: string, userId: string, role: HubMemberRole): Promise<{ serialize(): HubMembershipView }>;
  findMembership(
    hubId: string,
    userId: string,
  ): Promise<{ id: { toValue(): string }; serialize(): HubMembershipView } | null>;
}

interface HubInvitationServiceDeps {
  invitationRepository: HubInvitationRepository;
  hubRepository: HubRepository;
  membershipService: HubMembershipWriter;
  userRepository: HubInvitationUserSource;
}

export interface CreateHubInvitationInput {
  hubId: string;
  email: string;
  role: HubMemberRole;
  /** Clamped into [1h, 30d]; defaults to a week. */
  expiresInHours?: number;
  /** Platform actor id, for the audit trail. */
  invitedBy: string;
}

/**
 * What the API returns. Deliberately **not** `IHubInvitation`: `tokenHash` is an
 * internal lookup key, and a hash in an API response is one step away from being
 * used as a credential.
 */
export interface HubInvitationView extends Omit<IHubInvitation, 'tokenHash'> {
  roleLabel: string;
  /** The deadline has passed, so the link can no longer be redeemed. */
  isExpired: boolean;
}

export interface CreatedHubInvitation {
  invitation: HubInvitationView;
  /** The only time the raw token exists outside the admin's clipboard. */
  token: string;
}

export interface HubInvitationPreview {
  hubId: string;
  hubName: string;
  email: string;
  role: HubMemberRole;
  roleLabel: string;
  expiresAt: Date;
  status: HubInvitationStatus;
  /** True when the signed-in user's own address is the one invited. */
  emailMatches: boolean;
  alreadyMember: boolean;
  /** Sign-in email, so the accept page can explain a mismatch instead of just failing. */
  currentUserEmail: string | null;
}

export interface AcceptHubInvitationResult {
  hubId: string;
  hubName: string;
  membership: HubMembershipView;
  /** False when the user was already a member (the invitation is just spent). */
  created: boolean;
}

/**
 * Hub V2 Fase 20 — invite someone into a hub by email.
 *
 * The token is bearer material: whoever holds it can join the hub. It is
 * therefore stored only as a SHA-256 digest, returned exactly once at creation,
 * and bound to the invited address at accept time — a link that leaks in a chat
 * is useless to anyone who is not that address.
 */
export class HubInvitationService {
  constructor(private readonly deps: HubInvitationServiceDeps) {}

  async create(input: CreateHubInvitationInput): Promise<CreatedHubInvitation> {
    const email = normalizeInvitationEmail(input.email ?? '');
    if (!isValidInvitationEmail(email)) {
      throw new ValidationError('Format email undangan tidak valid');
    }
    if (!HUB_MEMBER_ROLES.includes(input.role)) {
      throw new ValidationError(
        `Role hub tidak valid: ${input.role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`,
      );
    }

    const hub = await this.deps.hubRepository.findById(input.hubId);
    if (!hub) throw new NotFoundError('Hub', input.hubId);
    if (hub.isArchived()) {
      throw new ValidationError(
        'Hub berstatus archived tidak dapat diubah. Kembalikan statusnya ke Aktif atau Ditangguhkan terlebih dahulu.',
      );
    }

    await this.assertInvitable(email, input.hubId);

    const token = generateInvitationToken();
    const invitation = HubInvitation.create({
      hubId: input.hubId,
      email,
      role: input.role,
      tokenHash: hashInvitationToken(token),
      expiresAt: this.resolveExpiry(input.expiresInHours),
      invitedBy: input.invitedBy ?? '',
    });

    try {
      await this.deps.invitationRepository.save(invitation);
    } catch (error) {
      // The unique partial index on (hubId, email, pending) is the real guard
      // against two admins submitting the same address at once.
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('Sudah ada undangan menunggu untuk email ini di hub ini');
      }
      throw error;
    }

    return { invitation: this.toView(invitation), token };
  }

  async listForHub(hubId: string): Promise<HubInvitationView[]> {
    const invitations = await this.deps.invitationRepository.findByHub(hubId);
    const stamped = await this.stampExpired(invitations);
    return stamped.map((invitation) => this.toView(invitation));
  }

  /**
   * Open invitations that can still be redeemed. Expiry is part of the query
   * rather than a filter over `status:'pending'`, so a hub nobody has opened
   * since an invite lapsed still reports an honest zero.
   */
  async countUsablePending(hubId: string): Promise<number> {
    return this.deps.invitationRepository.countUsablePendingByHub(hubId, new Date());
  }

  async revoke(hubId: string, invitationId: string): Promise<HubInvitationView> {
    const invitation = await this.deps.invitationRepository.findById(invitationId);
    if (!invitation || invitation.serialize().hubId !== hubId) {
      throw new NotFoundError('HubInvitation', invitationId);
    }
    if (!invitation.isPending()) {
      throw new ValidationError(
        `Undangan sudah ${invitation.serialize().status} dan tidak bisa dicabut`,
      );
    }

    invitation.revoke();
    await this.deps.invitationRepository.save(invitation);
    return this.toView(invitation);
  }

  /** Read-only look at an invitation, for the accept page to render before the click. */
  async preview(token: string, userId: string): Promise<HubInvitationPreview> {
    const { invitation } = await this.resolveByToken(token);
    const data = invitation.serialize();

    const hub = await this.deps.hubRepository.findById(data.hubId);
    const user = await this.deps.userRepository.findByIdRaw(userId);
    const currentUserEmail = user ? normalizeInvitationEmail(user.emailValue) : null;
    const membership = await this.deps.membershipService.findMembership(data.hubId, userId);

    return {
      hubId: data.hubId,
      hubName: hub?.serialize().name ?? data.hubId,
      email: data.email,
      role: data.role,
      roleLabel: HUB_MEMBER_ROLE_LABELS[data.role] ?? data.role,
      expiresAt: data.expiresAt,
      status: this.effectiveStatus(invitation),
      emailMatches: !!currentUserEmail && currentUserEmail === data.email,
      alreadyMember: !!membership,
      currentUserEmail,
    };
  }

  async accept(token: string, userId: string): Promise<AcceptHubInvitationResult> {
    const { invitation, hub } = await this.resolveByToken(token);
    const data = invitation.serialize();

    // A suspended or archived hub must not gain members through the back door.
    if (hub.isArchived()) {
      throw new ValidationError('Undangan ditolak: hub sudah diarsipkan');
    }

    const status = this.effectiveStatus(invitation);
    if (status !== 'pending') {
      throw new ValidationError(this.statusMessage(status));
    }

    const user = await this.deps.userRepository.findByIdRaw(userId);
    if (!user) throw new NotFoundError('User', userId);

    // The token is the credential, but the *address* it was issued to is part of
    // the contract: without this check a leaked link joins whoever opens it.
    const userEmail = normalizeInvitationEmail(user.emailValue);
    if (userEmail !== data.email) {
      throw new ForbiddenError(
        `Undangan ini ditujukan ke ${data.email}, sedangkan akun Anda terdaftar sebagai ${userEmail}`,
      );
    }

    const existing = await this.deps.membershipService.findMembership(data.hubId, userId);
    if (existing) {
      // The admin may have added this person manually while the invite was open.
      // Spending the invite is the honest outcome: the goal is reached, and a
      // live `pending` row would block a re-invite for the same address.
      invitation.accept(userId);
      await this.deps.invitationRepository.save(invitation);
      const memberData = existing.serialize();
      return {
        hubId: data.hubId,
        hubName: hub.serialize().name,
        membership: { ...memberData, id: existing.id.toValue() },
        created: false,
      };
    }

    const membership = await this.deps.membershipService.addMembership(data.hubId, userId, data.role);
    invitation.accept(userId);
    await this.deps.invitationRepository.save(invitation);

    const memberData = membership.serialize();
    return {
      hubId: data.hubId,
      hubName: hub.serialize().name,
      membership: { ...memberData, id: memberData.id },
      created: true,
    };
  }

  // ----------------------------------------------------------------- helpers

  /**
   * Resolve a raw token to its invitation, stamping an expired-but-still-pending
   * row on the way so the status a caller sees matches what is stored.
   */
  private async resolveByToken(token: string): Promise<{ invitation: HubInvitation; hub: Hub }> {
    const raw = (token ?? '').trim();
    if (!raw) {
      throw new ValidationError('Token undangan wajib diisi');
    }

    const invitation = await this.deps.invitationRepository.findByTokenHash(hashInvitationToken(raw));
    if (!invitation) {
      throw new NotFoundError('Undangan hub');
    }

    const hub = await this.deps.hubRepository.findById(invitation.serialize().hubId);
    if (!hub) {
      throw new NotFoundError('Hub', invitation.serialize().hubId);
    }

    if (invitation.isPending() && invitation.hasExpired() && invitation.markExpired()) {
      await this.deps.invitationRepository.save(invitation);
    }

    return { invitation, hub };
  }

  private effectiveStatus(invitation: HubInvitation): HubInvitationStatus {
    const status = invitation.serialize().status;
    return status === 'pending' && invitation.hasExpired() ? 'expired' : status;
  }

  private statusMessage(status: HubInvitationStatus): string {
    switch (status) {
      case 'accepted':
        return 'Undangan ini sudah pernah diterima';
      case 'revoked':
        return 'Undangan ini sudah dicabut oleh admin hub';
      case 'expired':
        return 'Undangan ini sudah kedaluwarsa. Minta admin mengirim ulang.';
      default:
        return 'Undangan ini tidak bisa digunakan';
    }
  }

  /**
   * Guard the create path. An expired-but-unstamped row would still occupy the
   * `(hubId, email, pending)` index slot, so it is stamped here rather than
   * leaving the admin with an unexplained duplicate-key error.
   */
  private async assertInvitable(email: string, hubId: string): Promise<void> {
    const existingUser = await this.deps.userRepository.findByEmailGlobal(email);
    if (existingUser) {
      const membership = await this.deps.membershipService.findMembership(
        hubId,
        existingUser.id.toValue(),
      );
      if (membership) {
        throw new ConflictError('User ini sudah menjadi anggota hub tersebut');
      }
    }

    const pending = await this.deps.invitationRepository.findPendingByHubAndEmail(hubId, email);
    if (!pending) return;

    if (pending.hasExpired() && pending.markExpired()) {
      await this.deps.invitationRepository.save(pending);
      return;
    }
    throw new ConflictError('Sudah ada undangan menunggu untuk email ini di hub ini');
  }

  private resolveExpiry(expiresInHours?: number): Date {
    const requested = expiresInHours ?? HUB_INVITATION_DEFAULT_TTL_HOURS;
    if (typeof requested !== 'number' || Number.isNaN(requested)) {
      throw new ValidationError('Masa berlaku undangan tidak valid');
    }
    const clamped = Math.min(HUB_INVITATION_MAX_TTL_HOURS, Math.max(HUB_INVITATION_MIN_TTL_HOURS, Math.floor(requested)));
    return new Date(Date.now() + clamped * 60 * 60 * 1000);
  }

  private async stampExpired(invitations: HubInvitation[]): Promise<HubInvitation[]> {
    const now = new Date();
    const out: HubInvitation[] = [];
    for (const invitation of invitations) {
      if (invitation.isPending() && invitation.hasExpired(now) && invitation.markExpired()) {
        await this.deps.invitationRepository.save(invitation);
      }
      out.push(invitation);
    }
    return out;
  }

  private toView(invitation: HubInvitation): HubInvitationView {
    const data = invitation.serialize();
    const { tokenHash: _tokenHash, ...rest } = data;
    // Derived from the *effective* status, not the stored one: the list and the
    // create paths both stamp a lapsed invitation before rendering it, so
    // `status === 'pending' && hasExpired()` would be false exactly when the
    // invite is expired.
    return {
      ...rest,
      roleLabel: HUB_MEMBER_ROLE_LABELS[data.role] ?? data.role,
      isExpired: this.effectiveStatus(invitation) === 'expired',
    };
  }
}

/** Mongo duplicate-key error, matched structurally (no mongo driver import). */
function isDuplicateKeyError(error: unknown): boolean {
  const candidate = error as { code?: unknown; codeName?: unknown } | null;
  return candidate?.code === 11000 || candidate?.codeName === 'DuplicateKey';
}
