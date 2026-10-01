import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GeneralSettingsPage from '../../src/core/settings/pages/GeneralSettingsPage';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/@shared/hooks/useToast', () => ({
  toast: vi.fn(),
}));

import { api } from '../../src/@shared/services/api';

const mockTenantData = {
  id: 'tenant-1',
  name: 'Toko Kopi Utama',
  slug: 'toko-kopi-utama',
  businessType: 'cafe',
  status: 'active',
  plan: 'Pro',
  config: {
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    locale: 'id-ID',
    taxRate: 11,
    taxName: 'PPN',
    ppnEnabled: true,
    ppnRate: 11,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    roundingEnabled: false,
    roundingMode: 'nearest',
    roundingDenomination: 0,
  },
};

describe('GeneralSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tenants/current') {
        return Promise.resolve({ data: { success: true, data: mockTenantData } });
      }
      if (url === '/tax/rules') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/tax/charges') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/pricing-profiles') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/templates') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it('renders settings topbar, sidebar, and initial profile section', async () => {
    render(
      <TestQueryProvider>
        <GeneralSettingsPage />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Pengaturan')).toBeInTheDocument();
    expect(screen.getAllByText('Profil Toko').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pajak & Service')).toBeInTheDocument();
    expect(screen.getByText('Batas Diskon')).toBeInTheDocument();
    expect(screen.getByText('Pembulatan')).toBeInTheDocument();
    expect(screen.getByText('QRIS Gateway')).toBeInTheDocument();
    expect(screen.getByText('Struk & Cetak')).toBeInTheDocument();

    expect(await screen.findByDisplayValue('Toko Kopi Utama')).toBeInTheDocument();
  });

  it('switches between settings sections when sidebar items are clicked', async () => {
    render(
      <TestQueryProvider>
        <GeneralSettingsPage />
      </TestQueryProvider>,
    );

    expect((await screen.findAllByText('Profil Toko')).length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByText('Pembulatan'));
    expect(await screen.findByText('Aktifkan Pembulatan')).toBeInTheDocument();

    await userEvent.click(screen.getByText('QRIS Gateway'));
    expect(await screen.findByText('Aktifkan QRIS Gateway')).toBeInTheDocument();
  });
});
