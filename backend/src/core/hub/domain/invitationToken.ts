import { createHash, randomBytes } from 'node:crypto';

/**
 * Invitation token handling (Fase 20).
 *
 * The raw token exists in exactly two places: the `POST` response that created
 * the invitation, and the link the admin copies to the invitee. Only its SHA-256
 * digest is persisted, so a database dump cannot be replayed as an invitation.
 *
 * A plain digest — no bcrypt/salt — is deliberate: the token is 256 bits of
 * `randomBytes`, so there is no dictionary to attack and no benefit from a slow
 * KDF, while a salt would make "is this the same token?" impossible to answer
 * without a lookup per candidate.
 */
export const HUB_INVITATION_TOKEN_BYTES = 32;

export function generateInvitationToken(): string {
  return randomBytes(HUB_INVITATION_TOKEN_BYTES).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}
