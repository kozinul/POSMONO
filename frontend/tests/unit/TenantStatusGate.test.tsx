import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TenantStatusGate, tenantBlock } from '../../src/core/pos/components/TenantStatusGate';
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

const refetch = vi.fn();

function mockTenant(partial: Partial<typeof baseTenant> | null, isPending = false) {
  vi.mocked(useTenant).mockReturnValue({
    data: partial ? { ...baseTenant, ...partial } : undefined,
    isPending,
    refetch,
  } as never);
}

function renderGate() {
  return render(
    <TestQueryProvider>
      <TenantStatusGate />
    </TestQueryProvider>,
  );
}

describe('TenantStatusGate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders nothing while the tenant is still loading (no flash of refusal)', () => {
    mockTenant(null, true);
    renderGate();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders nothing for an active tenant inside the period', () => {
    mockTenant(baseTenant);
    renderGate();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders nothing for a trial tenant without expiry (platform / tanpa batas)', () => {
    mockTenant({ status: 'trial', subscriptionExpiresAt: null });
    renderGate();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('DENY: blocks a suspended tenant with a non-dismissible dialog', () => {
    mockTenant({ status: 'suspended' });
    renderGate();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Transaksi Dinonaktifkan')).toBeInTheDocument();
    expect(dialog.textContent).toContain('ditangguhkan');
    expect(dialog.textContent).toContain('transaksi tidak dapat dilakukan');
    // The only control is the recheck — nothing may dismiss the refusal.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Periksa Ulang');
  });

  it('DENY: blocks a frozen tenant with its status label', () => {
    mockTenant({ status: 'frozen' });
    renderGate();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Dibekukan');
    expect(dialog.textContent).toContain('dibekukan');
  });

  it('DENY: blocks when the period ran out but the sweep has not suspended yet', () => {
    mockTenant({
      status: 'active',
      subscriptionExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    renderGate();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Masa Aktif Berakhir');
    expect(dialog.textContent).toContain('telah berakhir');
  });

  it('rechecks the status when the button is pressed', () => {
    mockTenant({ status: 'suspended' });
    renderGate();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Ulang' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('tenantBlock: an admin status blocks even without an expiry set', () => {
    expect(tenantBlock({ ...baseTenant, status: 'deactivated', subscriptionExpiresAt: null })).not.toBeNull();
  });

  it('tenantBlock: active with a future expiry is not blocked', () => {
    expect(tenantBlock(baseTenant)).toBeNull();
    expect(tenantBlock(undefined)).toBeNull();
  });
});
