import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingSection from '../../src/core/settings/sections/BillingSection';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import { useTenant } from '../../src/@shared/hooks/useTenant';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../src/@shared/hooks/useTenant', () => ({
  useTenant: vi.fn(),
}));

vi.mock('../../src/@shared/hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn(() => Promise.resolve({ isConfirmed: false })) },
}));

import { api } from '../../src/@shared/services/api';

const PENDING_INVOICE = {
  id: 'inv-1',
  number: 'SUB-2026-001',
  planId: 'plan-pro',
  amount: 199000,
  status: 'pending',
  createdAt: '2026-10-01T00:00:00.000Z',
  periodStart: '2026-10-01T00:00:00.000Z',
  periodEnd: '2026-11-01T00:00:00.000Z',
};

function mockBillingApi() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/tenants/current/entitlement') {
      return Promise.resolve({ data: { success: true, data: { plan: { name: 'Pro' } } } });
    }
    if (url === '/tenants/current/subscription/invoices') {
      return Promise.resolve({
        data: { success: true, data: { items: [PENDING_INVOICE], totals: { outstanding: 199000, paid: 0 } } },
      });
    }
    if (url === '/tenants/current/subscription/payments') {
      return Promise.resolve({ data: { success: true, data: { items: [] } } });
    }
    return Promise.resolve({ data: { success: true, data: {} } });
  });
}

function setUser(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u-1',
      email: 'owner@t1.test',
      displayName: 'Owner Toko',
      tenantId: 't1',
      roleName: 'Owner',
      permissions,
    },
  } as never);
}

function renderSection() {
  return render(
    <TestQueryProvider>
      <BillingSection />
    </TestQueryProvider>,
  );
}

describe('BillingSection — settings.billing.update gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useTenant).mockReturnValue({
      data: { subscriptionExpiresAt: '2026-11-01T00:00:00.000Z' },
      isLoading: false,
      isError: false,
    } as never);
    mockBillingApi();
  });

  it('ALLOW: owner with settings.billing.update sees the pay button', async () => {
    setUser(['settings.billing.read', 'settings.billing.update']);
    renderSection();

    expect(await screen.findByText('Bayar / Simulasi')).toBeTruthy();
    expect(screen.queryByText('Butuh izin Owner')).toBeNull();
  });

  it('DENY: manager with only settings.billing.read gets no pay button', async () => {
    setUser(['settings.billing.read']);
    renderSection();

    expect(await screen.findByText('Butuh izin Owner')).toBeTruthy();
    expect(screen.queryByText('Bayar / Simulasi')).toBeNull();
  });

  it('DENY: cashier without billing permissions gets no pay button', async () => {
    setUser(['orders:read']);
    renderSection();

    expect(await screen.findByText('Butuh izin Owner')).toBeTruthy();
    expect(screen.queryByText('Bayar / Simulasi')).toBeNull();
  });
});
