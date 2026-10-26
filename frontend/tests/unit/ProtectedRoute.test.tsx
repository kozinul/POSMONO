import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../src/@shared/components/ProtectedRoute';
import { useAuthStore } from '../../src/@shared/hooks/useAuth';

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          <Route path="/pos" element={<div>POS</div>} />
          <Route path="/kds" element={<div>KDS BOARD</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: 'kds-1',
      email: 'kds@alpha.test',
      displayName: 'Dapur',
      role: 'kds',
      roleName: 'KDS',
      outletIds: [],
      tenantId: 't1',
    },
    isAuthenticated: true,
    activeOutletId: null,
  } as never);
});

describe('ProtectedRoute KDS-only role', () => {
  it('allows the KDS board', () => {
    renderPath('/kds');
    expect(screen.getByText('KDS BOARD')).toBeInTheDocument();
  });

  it('redirects the dashboard to the KDS board', () => {
    renderPath('/dashboard');
    expect(screen.getByText('KDS BOARD')).toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('redirects POS to the KDS board', () => {
    renderPath('/pos');
    expect(screen.getByText('KDS BOARD')).toBeInTheDocument();
    expect(screen.queryByText('POS')).not.toBeInTheDocument();
  });
});
