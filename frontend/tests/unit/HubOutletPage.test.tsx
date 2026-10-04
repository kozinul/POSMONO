import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HubOutletPage from '../../src/core/hub/pages/HubOutletPage';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import type { MyHubOutletOverview } from '../../src/@shared/hooks/useMyHub';

const apiGet = vi.fn();

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
  },
}));

const HUB = {
  id: 'hub-1',
  code: 'BCA',
  name: 'BCA Hospitality',
  description: null,
  status: 'active',
  isActive: true,
  ownerUserId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  role: 'owner',
  roleLabel: 'Hub Owner',
  permissions: ['hub.read', 'hub.reports.read'],
};

function overview(overrides: Partial<MyHubOutletOverview> = {}): MyHubOutletOverview {
  return {
    hub: HUB,
    dateFrom: '2026-09-24T00:00:00.000Z',
    dateTo: '2026-10-01T00:00:00.000Z',
    generatedAt: '2026-10-01T12:00:00.000Z',
    outlet: { id: 'out-a', name: 'Outlet Sanur', tenantId: 'tenant-a', tenantName: 'Alpha Kopi', isActive: true },
    sales: { currency: 'IDR', total: 1_500_000, transactions: 12, tax: 150_000, discount: 50_000, rounding: 0 },
    operational: { staleHours: 24, hasOpenShift: true, openShifts: 1, lastShiftAt: '2026-10-01T09:00:00.000Z', isStale: false, idleHours: 3 },
    members: { total: 7 },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HubOutletPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ activeOutletId: 'out-a' });
});

describe('HubOutletPage (Hub V2 Fase 23)', () => {
  describe('outlet selection', () => {
    it('asks for the outlet view without naming a hub', async () => {
      apiGet.mockResolvedValue({ data: { success: true, data: overview() } });

      renderPage();

      await waitFor(() => expect(apiGet).toHaveBeenCalled());
      // No hubId in the path: the server derives the hub from X-Outlet-Id, so the
      // client cannot hand it a hub the member may not belong to.
      expect(apiGet.mock.calls[0][0]).toMatch(/^\/hub\/outlet\/overview/);
      expect(apiGet.mock.calls[0][0]).not.toContain('hub-1');
    });

    it('explains that an outlet must be picked, and fires no request', async () => {
      useAuthStore.setState({ activeOutletId: null });

      renderPage();

      expect(screen.getByText(/Pilih outlet/i)).toBeInTheDocument();
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('passes the period as query parameters', async () => {
      apiGet.mockResolvedValue({ data: { success: true, data: overview() } });

      renderPage();

      await waitFor(() => expect(apiGet).toHaveBeenCalled());
      const url = apiGet.mock.calls[0][0] as string;
      expect(url).toContain('dateFrom=');
      expect(url).toContain('dateTo=');
    });
  });

  describe('the outlet screen', () => {
    it('names the outlet and the hub it belongs to, plus the member role', async () => {
      apiGet.mockResolvedValue({ data: { success: true, data: overview() } });

      renderPage();

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Outlet Sanur' })).toBeInTheDocument());
      expect(screen.getByText(/dari hub BCA Hospitality/)).toBeInTheDocument();
      expect(screen.getByText(/peran Anda: Hub Owner/)).toBeInTheDocument();
    });

    it('shows sales and the shift status for this outlet only', async () => {
      apiGet.mockResolvedValue({ data: { success: true, data: overview() } });

      renderPage();

      await waitFor(() => expect(screen.getByText('Rp 1.500.000')).toBeInTheDocument());
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Rp 150.000')).toBeInTheDocument();
      expect(screen.getByText('Rp 50.000')).toBeInTheDocument();
      expect(screen.getByText(/shift buka · 1/)).toBeInTheDocument();
      expect(screen.getByText(/3 jam lalu/)).toBeInTheDocument();
    });

    it('shows the rounding line only when there was rounding', async () => {
      apiGet.mockResolvedValue({ data: { success: true, data: overview() } });
      const { unmount } = renderPage();
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Outlet Sanur' })).toBeInTheDocument());
      expect(screen.queryByText(/Pembulatan periode ini/)).toBeNull();
      unmount();

      apiGet.mockResolvedValue({
        data: { success: true, data: overview({ sales: { currency: 'IDR', total: 100, transactions: 1, tax: 0, discount: 0, rounding: 500 } }) },
      });
      renderPage();
      await waitFor(() => expect(screen.getByText(/Pembulatan periode ini/)).toBeInTheDocument());
    });

    it('warns when the outlet has gone stale', async () => {
      apiGet.mockResolvedValue({
        data: {
          success: true,
          data: overview({
            operational: { staleHours: 24, hasOpenShift: false, openShifts: 0, lastShiftAt: null, isStale: true, idleHours: null },
          }),
        },
      });

      renderPage();

      await waitFor(() => expect(screen.getByText(/belum pernah membuka shift/)).toBeInTheDocument());
      expect(screen.getByText('perhatian')).toBeInTheDocument();
    });

    it('counts hub members', async () => {
      apiGet.mockResolvedValue({ data: { success: true, data: overview() } });

      renderPage();

      await waitFor(() => expect(screen.getByText('Anggota hub')).toBeInTheDocument());
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  describe('DENY — a viewer has no hub.reports.read', () => {
    it('explains the missing permission instead of showing a raw status code', async () => {
      apiGet.mockRejectedValue({ response: { status: 403, data: { error: { message: 'Forbidden' } } } });

      renderPage();

      await waitFor(() => expect(screen.getByText(/tidak punya izin/i)).toBeInTheDocument());
      expect(screen.queryByText('Forbidden')).toBeNull();
    });
  });

  describe('other failures', () => {
    it('shows the server message when the request fails another way', async () => {
      apiGet.mockRejectedValue({ response: { status: 404, data: { error: { message: 'Outlet ini belum terhubung ke hub mana pun' } } } });

      renderPage();

      await waitFor(() => expect(screen.getByText(/belum terhubung ke hub/)).toBeInTheDocument());
    });

    it('falls back to a neutral message when the server sends none', async () => {
      apiGet.mockRejectedValue(new Error('Network down'));

      renderPage();

      await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument());
    });
  });
});