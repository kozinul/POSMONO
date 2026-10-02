import { ValidationError } from '../infrastructure/error/AppError';

/** Default reporting window when the caller sends no `dateFrom`. */
export const DEFAULT_REPORT_RANGE_DAYS = 30;

/**
 * Resolves a `?dateFrom=&dateTo=` query pair into day-bounded dates.
 *
 * Extracted from `PlatformController` in Hub V2 Fase 21: the hub overview is
 * served from two surfaces (Terminal Center and `/api/hub/:hubId/overview`), and a
 * date rule with two owners is a rule that will drift — the two answers would
 * differ on defaults, on the invalid-date error, and on whether an omitted bound
 * is midnight or end-of-day.
 *
 * Bounds are expanded, not truncated: `dateTo` is the *whole* day. Without this,
 * `?dateTo=2026-10-01` would silently cover only the first millisecond of that
 * day.
 */
export function resolveDateRange(
  dateFrom?: string,
  dateTo?: string,
  options: { defaultDays?: number } = {},
): [Date, Date] {
  const defaultDays = options.defaultDays ?? DEFAULT_REPORT_RANGE_DAYS;
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new ValidationError('Invalid dateFrom/dateTo — expected YYYY-MM-DD');
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return [from, to];
}