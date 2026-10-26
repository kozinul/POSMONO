import { useState } from 'react';
import Swal from 'sweetalert2';
import { useCategories } from '../../pos/hooks/useProducts';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { useOutlets } from '../../../@shared/hooks/useOutlets';
import { usePrinters } from '../../printing/hooks/usePrinters';
import {
  useCreateStation,
  useDeleteStation,
  useKdsStations,
  useUpdateStation,
  type StationKind,
} from '../hooks/useKds';

const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500';

/**
 * Station CRUD lives next to printer settings because a station is mostly a
 * print/routing target: categories decide which items land on it, and the
 * printer decides whether a KOT is also printed. The KDS board itself only
 * reads this config.
 */
export default function KdsStationsSection({ canWrite }: { canWrite: boolean }) {
  const { data: stations = [], isLoading } = useKdsStations();
  const { data: printers = [] } = usePrinters();
  const { data: categories = [] } = useCategories();
  const { data: outlets = [] } = useOutlets();
  const activeOutletId = useAuthStore((state) => state.activeOutletId);
  const createStation = useCreateStation();
  const updateStation = useUpdateStation();
  const deleteStation = useDeleteStation();

  const [name, setName] = useState('');
  const [outletId, setOutletId] = useState('');
  const [kind, setKind] = useState<StationKind>('kitchen');
  const [printerId, setPrinterId] = useState('');
  const [timerWarnMinutes, setTimerWarnMinutes] = useState(10);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const activeOutlets = outlets.filter((outlet) => outlet.isActive);
  const selectedOutletId =
    outletId ||
    activeOutlets.find((outlet) => outlet.id === activeOutletId)?.id ||
    activeOutlets[0]?.id ||
    '';

  const toggleCategory = (id: string) => {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) return setError('Nama station wajib diisi.');
    try {
      await createStation.mutateAsync({
        outletId: selectedOutletId || undefined,
        name: name.trim(),
        kind,
        printerId: printerId || null,
        timerWarnMinutes,
        categoryIds,
      });
      setName('');
      setCategoryIds([]);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data;
      setError(data?.error?.message || data?.message || 'Gagal menyimpan station.');
    }
  };

  const remove = async (stationId: string, stationName: string) => {
    const result = await Swal.fire({
      title: `Hapus station ${stationName}?`,
      text: 'Tiket yang sudah ada tidak dihapus, tetapi station tidak lagi menerima tiket baru.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (result.isConfirmed) await deleteStation.mutateAsync(stationId);
  };

  if (!canWrite) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-900">Station KDS</h2>
      <p className="mb-4 text-sm text-gray-500">
        Kategori menentukan item mana yang masuk ke station. Item tanpa kategori tidak dikirim ke KDS.
      </p>

      <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500" htmlFor="kds-station-outlet">
              Outlet
            </label>
            {activeOutlets.length > 1 ? (
              <select id="kds-station-outlet" className={inputCls} value={selectedOutletId} onChange={(e) => setOutletId(e.target.value)}>
                {activeOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                ))}
              </select>
            ) : (
              <p id="kds-station-outlet" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {activeOutlets[0]?.name ?? 'Belum ada outlet aktif'}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500" htmlFor="kds-station-name">
              Nama Station
            </label>
            <input id="kds-station-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dapur Utama" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500" htmlFor="kds-station-kind">
              Jenis
            </label>
            <select id="kds-station-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StationKind)}>
              <option value="kitchen">Dapur</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500" htmlFor="kds-station-printer">
              Printer KOT
            </label>
            <select id="kds-station-printer" className={inputCls} value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
              <option value="">Tanpa printer</option>
              {printers.filter((printer) => printer.purpose === 'kot').map((printer) => (
                <option key={printer.id} value={printer.id}>{printer.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase text-gray-500">Kategori</p>
          {categories.length === 0 ? (
            <p className="text-xs text-gray-500">Belum ada kategori.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category: { id: string; name: string }) => (
                <label key={category.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${categoryIds.includes(category.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'}`}>
                  <input type="checkbox" className="mr-1" checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />
                  {category.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500" htmlFor="kds-station-timer">
              Peringatan (menit)
            </label>
            <input id="kds-station-timer" type="number" min={1} className={`${inputCls} w-28`} value={timerWarnMinutes} onChange={(e) => setTimerWarnMinutes(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <button type="submit" disabled={createStation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {createStation.isPending ? 'Menyimpan…' : '+ Tambah Station'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-500">Memuat station…</p>
      ) : stations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Belum ada station KDS.
        </p>
      ) : (
        <div className="space-y-2">
          {stations.map((station) => (
            <div key={station.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div>
                <p className="font-semibold text-gray-900">
                  {station.name}{' '}
                  <span className="text-xs font-medium text-gray-500">({station.kind === 'bar' ? 'Bar' : 'Dapur'})</span>
                  {!station.isActive && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">NONAKTIF</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {station.categoryIds.length} kategori · peringatan {station.timerWarnMinutes} menit
                  {stations.find((item) => item.id === station.id)?.printerId ? ' · printer KOT' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateStation.mutate({ stationId: station.id, input: { isActive: !station.isActive } })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {station.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(station.id, station.name)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
