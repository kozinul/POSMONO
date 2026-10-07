import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HubRoute } from '../../src/@shared/components/HubRoute';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../src/@shared/services/api';

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    hubs: [],
    grants: [],
    tenants: [],
    effectivePermissions: [],
    blocked: null,
    ...overrides,
  };
}

function mockContext(data: Record<string, unknown>) {
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data } } as never);
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/hub']}>
      <TestQueryProvider>
        <Routes>
          <Route
            path="/hub"
            element={
              <HubRoute>
                <div>HUB CONTENT</div>
              </HubRoute>
            }
          />
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
          <Route path="/hub/login" element={<div>HUB LOGIN PAGE</div>} />
        </Routes>
      </TestQueryProvider>
    </MemoryRouter>,
  );
}

describe('HubRoute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: true } as never);
  });

  it('renders the hub content when the member has an active hub', async () => {
    mockContext(
      baseContext({
        hubs: [{ id: 'hub-1', code: 'HUB-1', name: 'Hub Nusantara', status: 'active', isActive: true }],
      }),
    );

    renderGate();

    expect(await screen.findByText('HUB CONTENT')).toBeInTheDocument();
  });

  it('explains a suspended membership instead of bouncing to login', async () => {
    mockContext(
      baseContext({
        blocked: { kind: 'membership_suspended', hubId: 'hub-1', hubName: 'Hub Nusantara' },
      }),
    );

    renderGate();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Hub Nusantara/)).toBeInTheDocument();
    expect(screen.getByText(/ditangguhkan/i)).toBeInTheDocument();
    expect(screen.queryByText('LOGIN PAGE')).not.toBeInTheDocument();
  });

  it('explains an archived hub', async () => {
    mockContext(
      baseContext({ blocked: { kind: 'hub_archived', hubId: 'hub-1', hubName: 'Hub Nusantara' } }),
    );

    renderGate();

    expect(await screen.findByText(/diarsipkan/i)).toBeInTheDocument();
  });

  it('redirects to the normal login when the member belongs to no hub', async () => {
    mockContext(baseContext());

    renderGate();

    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to the hub login', async () => {
    mockContext(baseContext());
    useAuthStore.setState({ isAuthenticated: false } as never);

    renderGate();

    expect(await screen.findByText('HUB LOGIN PAGE')).toBeInTheDocument();
  });
});
