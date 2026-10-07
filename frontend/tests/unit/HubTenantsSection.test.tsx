import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TenantsSection from '../../src/core/hub/sections/TenantsSection';

const DAY_MS = 24 * 60 * 60 * 1000;

function tenantRow(id: string, name: string, status: string, expiresInDays: number | null) {
  return {
    id,
    name,
    status,
    businessType: 'cafe',
    businessCategory: '',
    address: '',
    phone: '',
    subscriptionExpiresAt: expiresInDays === null ? null : new Date(Date.now() + expiresInDays * DAY_MS).toISOString(),
  };
}

function renderSection(tenants: ReturnType<typeof tenantRow>[]) {
  return render(<TenantsSection tenants={tenants as never} isLoading={false} error={null} />);
}

describe('hub TenantsSection masa aktif summary', () => {
  it('flags the hub when at least one tenant is expiring within 7 days', () => {
    renderSection([
      tenantRow('t1', 'Kopi Bali', 'active', 5),
      tenantRow('t2', 'Roti Manis', 'active', 30),
    ]);

    expect(screen.getByText(/1 tenant dalam hub berada di ambang masa aktif berakhir/)).toBeInTheDocument();
  });

  it('counts non-active tenants (admin status) into the warning', () => {
    renderSection([
      tenantRow('t1', 'Kopi Bali', 'active', 30),
      tenantRow('t2', 'Roti Manis', 'frozen', null),
    ]);

    expect(screen.getByText(/1 tenant dalam hub berada di ambang masa aktif berakhir/)).toBeInTheDocument();
  });

  it('is silent when every tenant has a healthy remaining period', () => {
    renderSection([
      tenantRow('t1', 'Kopi Bali', 'active', 30),
      tenantRow('t2', 'Roti Manis', 'active', 20),
    ]);

    expect(screen.queryByText(/tenant dalam hub berada di ambang/)).not.toBeInTheDocument();
  });

  it('keeps rendering the tenant table alongside the banner', () => {
    renderSection([
      tenantRow('t1', 'Kopi Bali', 'active', 5),
      tenantRow('t2', 'Roti Manis', 'active', 30),
    ]);

    expect(screen.queryByRole('alert')).not.toBe(null);
    expect(screen.getByText('Kopi Bali')).toBeInTheDocument();
    expect(screen.getByText('Roti Manis')).toBeInTheDocument();
  });
});