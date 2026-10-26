import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KdsPage from '../../src/core/kds/pages/KdsPage';
import { useKdsAccess, useKdsStations, useKdsTickets, useUpdateTicketStatus } from '../../src/core/kds/hooks/useKds';

vi.mock('../../src/core/kds/hooks/useKds', () => ({
  useKdsAccess: vi.fn(),
  useKdsStations: vi.fn(),
  useKdsTickets: vi.fn(),
  useUpdateTicketStatus: vi.fn(),
}));
vi.mock('../../src/core/printing/hooks/usePrinters', () => ({
  printKot: vi.fn(),
}));

const station = {
  id: 'station-1',
  tenantId: 't1',
  outletId: 'outlet-1',
  name: 'Dapur Utama',
  kind: 'kitchen' as const,
  printerId: null,
  autoPrint: false,
  timerWarnMinutes: 10,
  categoryIds: ['cat-food'],
  isActive: true,
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
};

const pendingTicket = {
  id: 'ticket-1',
  tenantId: 't1',
  outletId: 'outlet-1',
  stationId: 'station-1',
  orderId: 'order-1',
  orderNumber: 'ORD-1',
  tableNumber: 'A1',
  source: 'pos',
  items: [
    {
      orderItemIndex: 0,
      productId: 'p1',
      productName: 'Nasi Goreng',
      quantity: 2,
      notes: 'tanpa telur',
      modifiers: [{ groupId: 'g1', groupName: 'Level', optionId: 'o1', optionName: 'Pedas' }],
    },
  ],
  status: 'pending' as const,
  startedAt: null,
  completedAt: null,
  preparedBy: null,
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
};

describe('KdsPage', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useKdsAccess).mockReturnValue({ data: { enabled: true }, isLoading: false } as never);
    vi.mocked(useKdsStations).mockReturnValue({ data: [station], isLoading: false } as never);
    vi.mocked(useKdsTickets).mockReturnValue({ data: [pendingTicket], isLoading: false } as never);
    vi.mocked(useUpdateTicketStatus).mockReturnValue({ mutate, isPending: false } as never);
  });

  it('renders the three FIFO columns without prices or customer data', () => {
    render(<KdsPage />);

    expect(screen.getByText('Baru')).toBeInTheDocument();
    expect(screen.getByText('Sedang Dibuat')).toBeInTheDocument();
    expect(screen.getByText('Siap / Selesai')).toBeInTheDocument();
    expect(screen.getByText('2× Nasi Goreng')).toBeInTheDocument();
    expect(screen.getByText('+ Pedas')).toBeInTheDocument();
    expect(screen.getByText('tanpa telur')).toBeInTheDocument();
    expect(screen.queryByText(/25\.000/)).not.toBeInTheDocument();
  });

  it('moves a pending ticket to in_progress', () => {
    render(<KdsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Mulai' }));

    expect(mutate).toHaveBeenCalledWith({ ticketId: 'ticket-1', status: 'in_progress' });
  });

  it('explains that KDS is disabled when the module is absent', () => {
    vi.mocked(useKdsAccess).mockReturnValue({ data: { enabled: false }, isLoading: false } as never);

    render(<KdsPage />);

    expect(screen.getByText(/KDS belum aktif/)).toBeInTheDocument();
  });
});
