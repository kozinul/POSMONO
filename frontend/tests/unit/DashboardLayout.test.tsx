import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '../../src/layouts/DashboardLayout';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import { TestQueryProvider } from '../helpers';
import type { Outlet } from '../../src/@shared/hooks/useOutlets';

// The socket is irrelevant here; the layout opens a real connection otherwise.
vi.mock('../../src/@shared/hooks/useRealtimeSync', () => ({ useRealtimeSync: vi.fn() }));
vi.mock('../../src/@shared/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../src/@shared/services/api';

function outlet(id: string, name: string, isActive: boolean): Outlet {
  return {
    id,
    tenantId: 't1',
    name,
    address: null,
    phone: null,
    warehouseId: null,
    isActive,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockApi(outlets: Outlet[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/outlets') return Promise.resolve({ data: { success: true, data: outlets } } as never);
    if (url === '/auth/accessible-tenants')
      return Promise.resolve({ data: { success: true, data: [] } } as never);
    return Promise.resolve({ data: { success: true, data: [] } } as never);
  });
}

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <TestQueryProvider>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<div>DASHBOARD CONTENT</div>} />
          </Route>
        </Routes>
      </TestQueryProvider>
    </MemoryRouter>,
  );
}

function setUser(outletIds: string[], activeOutletId: string | null) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'budi@alpha.test',
      displayName: 'Budi',
      role: 'owner',
      roleName: 'Owner',
      outletIds,
      tenantId: 't1',
    },
    isAuthenticated: true,
    activeOutletId,
  } as never);
}

describe('DashboardLayout outlet switcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    setUser(['A', 'B', 'C'], 'A');
  });

  it('hides an inactive outlet but keeps the currently active one even if deactivated', async () => {
    // A is active, B is the currently-selected inactive outlet, C is inactive.
    // E is active but outside the user's outlet scope.
    mockApi([outlet('A', 'Outlet A', true), outlet('B', 'Outlet B', false), outlet('C', 'Outlet C', false), outlet('E', 'Outlet E', true)]);
    setUser(['A', 'B', 'C'], 'B');

    renderLayout();

    const select = await screen.findByLabelText('Pilih Outlet');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Outlet A', 'Outlet B']);
    expect(screen.queryByText('Outlet C')).not.toBeInTheDocument();
    expect(screen.queryByText('Outlet E')).not.toBeInTheDocument();
  });

  it('drops inactive outlets from the switchable list', async () => {
    mockApi([outlet('A', 'Outlet A', true), outlet('B', 'Outlet B', true), outlet('C', 'Outlet C', false)]);

    renderLayout();

    const select = await screen.findByLabelText('Pilih Outlet');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Outlet A', 'Outlet B']);
    expect(screen.queryByText('Outlet C')).not.toBeInTheDocument();
  });

  it('shows the outlet name (no switcher) when only one outlet remains available', async () => {
    mockApi([outlet('A', 'Outlet A', true), outlet('B', 'Outlet B', false)]);

    renderLayout();

    expect(await screen.findByText('Outlet A')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pilih Outlet')).not.toBeInTheDocument();
  });
});
