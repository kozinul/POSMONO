import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubscriptionBanner } from '../../src/@shared/components/SubscriptionBanner';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/hooks/useTenant', () => ({
  useTenant: vi.fn(),
}));

import { useTenant } from '../../src/@shared/hooks/useTenant';

const baseTenant = {
  id: 't1',
  name: 'Kopi Bali',
  status: 'active',
  subscriptionExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  daysRemaining: 10,
  config: {} as never,
};

function mockTenant(partial: Partial<typeof baseTenant> | null) {
  vi.mocked(useTenant).mockReturnValue({
    data: partial ? { ...baseTenant, ...partial } : undefined,
    isLoading: false,
    isError: false,
  } as never);
}

describe('SubscriptionBanner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders nothing while the tenant is still unknown', () => {
    mockTenant(null);
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the banner when the tenant has no expiry set (platform / trial tanpa batas)', () => {
    mockTenant({ subscriptionExpiresAt: null });
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the banner while the period is comfortably far away', () => {
    mockTenant({ daysRemaining: 10 });
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns in amber inside the 7-day window', () => {
    mockTenant({ daysRemaining: 5 });
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('tersisa 5 hari');
    expect(alert.className).toContain('amber');
  });

  it('turns red inside the 3-day window', () => {
    mockTenant({ daysRemaining: 2 });
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('segera perpanjang');
    expect(alert.className).toContain('red');
  });

  it('reports the period as over when the clock ran out but the sweep has not run', () => {
    mockTenant({ status: 'active', daysRemaining: 0 });
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    expect(screen.getByRole('alert').textContent).toContain('telah berakhir');
  });

  it('shows the refusal message for an admin-chosen status instead of a countdown', () => {
    mockTenant({ status: 'suspended', daysRemaining: 5 });
    render(
      <TestQueryProvider>
        <SubscriptionBanner />
      </TestQueryProvider>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('berstatus nonaktif');
    expect(alert.textContent).not.toContain('tersisa');
  });
});