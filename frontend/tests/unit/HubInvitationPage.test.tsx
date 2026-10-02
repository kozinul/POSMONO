import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HubInvitationPage from '../../src/core/hub/pages/HubInvitationPage';
import { TestQueryProvider } from '../helpers';

vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../src/@shared/services/api';

const TOKEN = 'token-undangan-123';

function preview(overrides: Record<string, unknown> = {}) {
  return {
    hubId: 'hub-1',
    hubName: 'BCA Hospitality',
    email: 'budi@kopi.id',
    role: 'viewer',
    roleLabel: 'Viewer',
    status: 'pending',
    expiresAt: '2099-01-01T00:00:00.000Z',
    currentUserEmail: 'budi@kopi.id',
    emailMatches: true,
    alreadyMember: false,
    ...overrides,
  };
}

function mockPreview(data: Record<string, unknown> | null) {
  if (data === null) {
    vi.mocked(api.get).mockRejectedValue({
      response: { data: { success: false, error: { message: 'Undangan hub tidak ditemukan' } } },
    });
    return;
  }
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data } } as never);
}

function renderPage() {
  return render(
    <TestQueryProvider>
      <MemoryRouter initialEntries={[`/hub-invitations/${TOKEN}`]}>
        <Routes>
          <Route path="/hub-invitations/:token" element={<HubInvitationPage />} />
          <Route path="/dashboard" element={<div>Dashboard Loaded</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </TestQueryProvider>,
  );
}

const acceptButton = () => screen.getByRole('button', { name: /Terima Undangan/ });

describe('HubInvitationPage (Hub V2 Fase 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------ ALLOW

  it('shows the invitation and accepts it, then lands on the dashboard', async () => {
    mockPreview(preview());
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          hubId: 'hub-1',
          hubName: 'BCA Hospitality',
          created: true,
          membership: { id: 'm1', hubId: 'hub-1', userId: 'u1', role: 'viewer' },
        },
      },
    } as never);

    renderPage();

    expect(await screen.findByText('BCA Hospitality')).toBeInTheDocument();
    expect(screen.getByText('budi@kopi.id')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();

    await userEvent.click(acceptButton());

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/hub-invitations/${TOKEN}/accept`),
    );
    expect(await screen.findByText('Dashboard Loaded')).toBeInTheDocument();
  });

  it('tells an existing member the acceptance only confirms what is already there', async () => {
    mockPreview(preview({ alreadyMember: true }));
    renderPage();

    expect(await screen.findByText(/sudah menjadi anggota/)).toBeInTheDocument();
    // Not blocked: redeeming is a no-op that still spends the invitation.
    expect(acceptButton()).toBeEnabled();
  });

  // ------------------------------------------------------------------- DENY

  it('DENIES a link opened by the wrong account, naming both addresses', async () => {
    mockPreview(preview({ currentUserEmail: 'mallory@kopi.id', emailMatches: false }));
    renderPage();

    expect(await screen.findByText(/mallory@kopi.id/)).toBeInTheDocument();
    expect(acceptButton()).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Ganti akun' }));
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('DENIES an expired invitation and points at a fresh link', async () => {
    mockPreview(preview({ status: 'expired', isExpired: true }));
    renderPage();

    expect(await screen.findByText(/kedaluwarsa/)).toBeInTheDocument();
    expect(acceptButton()).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('DENIES a revoked invitation', async () => {
    mockPreview(preview({ status: 'revoked' }));
    renderPage();

    expect(await screen.findByText(/dicabut/)).toBeInTheDocument();
    expect(acceptButton()).toBeDisabled();
  });

  it('DENIES re-accepting a spent invitation', async () => {
    mockPreview(preview({ status: 'accepted', alreadyMember: true }));
    renderPage();

    expect(await screen.findByText(/sudah pernah diterima/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sudah Diterima' })).toBeDisabled();
  });

  it('DENIES an unknown token with an explanation instead of a raw error', async () => {
    mockPreview(null);
    renderPage();

    expect(await screen.findByText('Undangan tidak berlaku')).toBeInTheDocument();
    expect(screen.getByText(/tidak ditemukan, sudah dicabut, atau sudah pernah dipakai/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Terima Undangan/ })).not.toBeInTheDocument();
  });

  it('shows the server message when the accept itself fails', async () => {
    mockPreview(preview());
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { success: false, error: { message: 'Anggota sudah menjadi anggota hub ini' } } },
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Terima Undangan/ }));
    expect(await screen.findByText('Anggota sudah menjadi anggota hub ini')).toBeInTheDocument();
    // The page stays put so the message is actually readable.
    expect(screen.getByRole('button', { name: /Terima Undangan/ })).toBeInTheDocument();
  });
});
