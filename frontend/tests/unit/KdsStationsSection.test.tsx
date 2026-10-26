import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KdsStationsSection from '../../src/core/kds/components/KdsStationsSection';

const createStation = vi.fn();

vi.mock('../../src/core/kds/hooks/useKds', () => ({
  useKdsStations: () => ({ data: [], isLoading: false }),
  useCreateStation: () => ({ mutateAsync: createStation, isPending: false }),
  useUpdateStation: () => ({ mutate: vi.fn() }),
  useDeleteStation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../../src/core/pos/hooks/useProducts', () => ({
  useCategories: () => ({ data: [] }),
}));
vi.mock('../../src/core/printing/hooks/usePrinters', () => ({
  usePrinters: () => ({ data: [] }),
}));
vi.mock('../../src/@shared/hooks/useOutlets', () => ({
  useOutlets: () => ({
    data: [
      { id: 'outlet-1', name: 'Kuta', isActive: true },
      { id: 'outlet-2', name: 'Ubud', isActive: true },
    ],
  }),
}));
vi.mock('../../src/@shared/hooks/useAuth', () => ({
  useAuthStore: (selector: (state: { activeOutletId: string }) => unknown) =>
    selector({ activeOutletId: 'outlet-2' }),
}));

describe('KdsStationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createStation.mockResolvedValue({});
  });

  it('creates a station for the active outlet instead of relying on a missing header', async () => {
    render(<KdsStationsSection canWrite />);

    fireEvent.change(screen.getByLabelText('Nama Station'), { target: { value: 'Dapur Ubud' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Tambah Station' }));

    await waitFor(() =>
      expect(createStation).toHaveBeenCalledWith(
        expect.objectContaining({ outletId: 'outlet-2', name: 'Dapur Ubud' }),
      ),
    );
  });
});
