/**
 * Hub V2 Fase 18 — `Hub.code`.
 *
 * The code is the short, human-quotable handle of a hub ("KOPI-NUSANTARA"),
 * used in conversations and exports. Two rules make it safe to show and to
 * compare: it is always uppercase, and it only ever contains `[A-Z0-9-]`.
 *
 * Normalising on **write** (not just on read) is what makes the unique index on
 * `code` equivalent to a case-insensitive uniqueness check: without it,
 * "kopi" and "KOPI" would be two distinct stored values and both would pass a
 * duplicate check.
 */
export const HUB_CODE_MAX_LENGTH = 24;

/**
 * Uppercase + strip everything that is not a letter or digit into dashes.
 *
 * A dash at either edge is dropped so the code never looks like a fragment
 * (`-KOPI-`), and runs of dashes collapse (`Kopi  Nusantara` → `KOPI-NUSANTARA`).
 */
export function normalizeHubCode(input: string): string {
  return input
    .normalize('NFKD')
    // strip combining marks so "Kedai Koplas" → "KEDAI-KOPLAS", not "KEDAI-KOPLA"
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, HUB_CODE_MAX_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Code for a hub that has none yet, derived from its name.
 *
 * Returns an empty string when the name has no usable characters at all (e.g.
 * a name made only of emoji or punctuation) — the caller decides whether that
 * is an error or whether the code has to be supplied explicitly, because a hub
 * code is unique and cannot be invented from nothing.
 */
export function deriveHubCodeFromName(name: string): string {
  return normalizeHubCode(name);
}