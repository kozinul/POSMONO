import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { HUB_MEMBER_ROLES, type HubMemberRole } from './HubMembership';

class HubInvitationId extends Identifier {}

/**
 * Invitation lifecycle (Fase 20).
 *
 * `expired` is a real status rather than a computed view of `expiresAt`: once an
 * invitation has passed its deadline the row is stamped so the platform admin
 * sees it in the history instead of a "pending" invite that can never be used.
 */
export const HUB_INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;
export type HubInvitationStatus = (typeof HUB_INVITATION_STATUSES)[number];

/** One week is the default lifetime; the service clamps any request into this range. */
export const HUB_INVITATION_DEFAULT_TTL_HOURS = 24 * 7;
export const HUB_INVITATION_MIN_TTL_HOURS = 1;
export const HUB_INVITATION_MAX_TTL_HOURS = 24 * 30;

export interface IHubInvitation {
  id: string;
  hubId: string;
  /**
   * Normalised (trimmed, lowercased, `<>` stripped). The duplicate check and the
   * accept-time identity check both compare against this form, so an invite to
   * `Budi@Kopi.ID ` and a later sign-up as `budi@kopi.id` are the same person.
   */
  email: string;
  role: HubMemberRole;
  /**
   * SHA-256 of the raw token. The raw token is handed to the admin once, at
   * creation time, and is never stored — a leaked database row cannot be
   * redeemed.
   */
  tokenHash: string;
  expiresAt: Date;
  /** Platform actor that issued the invitation. */
  invitedBy: string;
  status: HubInvitationStatus;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type HubInvitationProps = Omit<
  IHubInvitation,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'acceptedBy' | 'acceptedAt' | 'revokedAt'
>;

/** Deliberately permissive: the real gate is "does a user own this address". */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeInvitationEmail(raw: string): string {
  return raw.trim().replace(/^<+/, '').replace(/>+$/, '').trim().toLowerCase();
}

export function isValidInvitationEmail(raw: string): boolean {
  return EMAIL_PATTERN.test(normalizeInvitationEmail(raw));
}

export class HubInvitation extends AggregateRoot<HubInvitationId> {
  private hubId: string;
  private email: string;
  private role: HubMemberRole;
  private tokenHash: string;
  private expiresAt: Date;
  private invitedBy: string;
  private status: HubInvitationStatus;
  private acceptedBy: string | null;
  private acceptedAt: Date | null;
  private revokedAt: Date | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IHubInvitation) {
    super(new HubInvitationId(props.id));
    this.hubId = props.hubId;
    this.email = props.email;
    this.role = props.role;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.invitedBy = props.invitedBy;
    this.status = props.status;
    this.acceptedBy = props.acceptedBy;
    this.acceptedAt = props.acceptedAt;
    this.revokedAt = props.revokedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: HubInvitationProps): HubInvitation {
    if (!HUB_MEMBER_ROLES.includes(props.role)) {
      throw new Error(
        `Invalid hub member role: ${props.role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`,
      );
    }

    return new HubInvitation({
      ...props,
      email: normalizeInvitationEmail(props.email),
      status: 'pending',
      acceptedBy: null,
      acceptedAt: null,
      revokedAt: null,
      id: new HubInvitationId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IHubInvitation): HubInvitation {
    return new HubInvitation(props);
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  hasExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  accept(userId: string): void {
    this.status = 'accepted';
    this.acceptedBy = userId;
    this.acceptedAt = new Date();
    this.updatedAt = new Date();
  }

  revoke(): void {
    this.status = 'revoked';
    this.revokedAt = new Date();
    this.updatedAt = new Date();
  }

  /** No-op unless still pending, so a race with `accept()` cannot rewrite history. */
  markExpired(): boolean {
    if (this.status !== 'pending') return false;
    this.status = 'expired';
    this.updatedAt = new Date();
    return true;
  }

  serialize(): IHubInvitation {
    return {
      id: this._id.toValue(),
      hubId: this.hubId,
      email: this.email,
      role: this.role,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      invitedBy: this.invitedBy,
      status: this.status,
      acceptedBy: this.acceptedBy,
      acceptedAt: this.acceptedAt,
      revokedAt: this.revokedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
