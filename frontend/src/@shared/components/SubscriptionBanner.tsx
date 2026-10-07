import { useTenant } from '../hooks/useTenant';

const GRACE_DAYS_WARN = 7;
const GRACE_DAYS_CRITICAL = 3;

/**
 * Active-period banner ("masa aktif"): amber below 7 days, red below 3 days or
 * when the period is over. A non-active status (admin choice) always renders
 * the refusal message, never a countdown. Hidden when the tenant has no expiry
 * (platform, trial without deadline).
 */
export function SubscriptionBanner() {
  const { data: tenant } = useTenant();

  if (!tenant || !tenant.subscriptionExpiresAt) return null;

  const isActiveStatus = tenant.status === 'active' || tenant.status === 'trial';
  const days = tenant.daysRemaining;

  let tone: 'critical' | 'warn';
  let message: string;

  if (!isActiveStatus) {
    tone = 'critical';
    message = 'Tenant Anda berstatus nonaktif — hubungi pengelola untuk mengaktifkannya kembali.';
  } else if (days <= 0) {
    tone = 'critical';
    message = 'Masa aktif tenant Anda telah berakhir — perpanjang agar layanan tetap berjalan.';
  } else if (days <= GRACE_DAYS_CRITICAL) {
    tone = 'critical';
    message = `Masa aktif tersisa ${days} hari — segera perpanjang sebelum layanan terhenti.`;
  } else if (days <= GRACE_DAYS_WARN) {
    tone = 'warn';
    message = `Masa aktif tersisa ${days} hari — hubungi pengelola untuk perpanjangan.`;
  } else {
    return null;
  }

  const cls =
    tone === 'critical'
      ? 'bg-red-50 text-red-800 border-red-200'
      : 'bg-amber-50 text-amber-900 border-amber-200';

  return (
    <div role="alert" className={`border-b px-6 py-2 text-sm font-medium ${cls}`}>
      {message}
    </div>
  );
}