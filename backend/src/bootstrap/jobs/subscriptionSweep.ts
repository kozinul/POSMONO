import type { DIContainer } from '../container';

export const SUBSCRIPTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** First pass ran shortly after boot so provisioning/seed have settled. */
export const SUBSCRIPTION_SWEEP_FIRST_DELAY_MS = 5_000;

/**
 * Starts the auto-suspend sweep for expired active periods
 * (`SubscriptionService.sweepExpired`). Returns a stop function; the interval
 * is unref'd so a running server is never kept alive by the timer alone.
 */
export function startSubscriptionSweep(container: DIContainer): () => void {
  const subscriptionService = container.resolve('subscriptionService');

  const run = (): void => {
    subscriptionService
      .sweepExpired()
      .then((result: { total: number; suspended: number }) => {
        if (result.suspended > 0) {
          console.info(`[subscriptionSweep] ${result.suspended}/${result.total} tenant(s) auto-suspended`);
        }
      })
      .catch((err: unknown) => {
        console.error('[subscriptionSweep] sweep failed', err);
      });
  };

  const first = setTimeout(run, SUBSCRIPTION_SWEEP_FIRST_DELAY_MS);
  const interval = setInterval(run, SUBSCRIPTION_SWEEP_INTERVAL_MS);

  if (typeof interval.unref === 'function') interval.unref();
  if (typeof first.unref === 'function') first.unref();

  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}