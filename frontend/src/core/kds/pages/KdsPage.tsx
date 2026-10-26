import { useEffect, useMemo, useState } from 'react';
import { printKot } from '../../printing/hooks/usePrinters';
import {
  useKdsAccess,
  useKdsStations,
  useKdsTickets,
  useUpdateTicketStatus,
  type KdsStation,
  type KdsTicket,
  type StationTicketStatus,
} from '../hooks/useKds';

const COLUMNS: Array<{ status: StationTicketStatus; title: string; tone: string }> = [
  { status: 'pending', title: 'Baru', tone: 'border-amber-300 bg-amber-50' },
  { status: 'in_progress', title: 'Sedang Dibuat', tone: 'border-blue-300 bg-blue-50' },
  { status: 'ready', title: 'Siap / Selesai', tone: 'border-emerald-300 bg-emerald-50' },
];

const NEXT_ACTION: Partial<Record<StationTicketStatus, { label: string; next: StationTicketStatus }>> = {
  pending: { label: 'Mulai', next: 'in_progress' },
  in_progress: { label: 'Selesai', next: 'ready' },
  ready: { label: 'Recall', next: 'in_progress' },
};

function elapsedMinutes(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

function TicketCard({
  ticket,
  station,
  now,
  busy,
  onStatus,
}: {
  ticket: KdsTicket;
  station: KdsStation;
  now: number;
  busy: boolean;
  onStatus: (status: StationTicketStatus) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const age = elapsedMinutes(ticket.createdAt, now);
  const late = age >= station.timerWarnMinutes;
  const action = NEXT_ACTION[ticket.status];

  const reprint = async () => {
    setPrinting(true);
    try {
      await printKot({ orderId: ticket.orderId, printerId: station.printerId ?? undefined });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <article className={`rounded-xl border-2 bg-white shadow-sm ${late ? 'border-red-400' : 'border-gray-200'}`}>
      <header className="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{ticket.orderNumber}</p>
          <p className="text-[11px] text-gray-500">
            {ticket.tableNumber ? `Meja ${ticket.tableNumber} · ` : ''}
            {ticket.source}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${late ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
          {age} mnt
        </span>
      </header>

      <ul className="divide-y divide-gray-100">
        {ticket.items.map((item) => (
          <li key={`${ticket.id}-${item.orderItemIndex}`} className="px-3 py-2">
            <p className="text-sm font-semibold text-gray-900">
              {item.quantity}× {item.productName}
            </p>
            {item.modifiers.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {item.modifiers.map((modifier) => (
                  <li key={modifier.optionId} className="text-[11px] text-gray-600">
                    + {modifier.optionName}
                  </li>
                ))}
              </ul>
            )}
            {item.notes && <p className="mt-1 text-[11px] italic text-amber-700">{item.notes}</p>}
          </li>
        ))}
      </ul>

      <footer className="flex gap-2 border-t px-3 py-2">
        {action && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus(action.next)}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          disabled={printing}
          onClick={reprint}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {printing ? 'Cetak…' : 'Reprint'}
        </button>
      </footer>
    </article>
  );
}

export default function KdsPage() {
  const { data: access, isLoading: accessLoading } = useKdsAccess();
  const { data: stations = [], isLoading: stationsLoading } = useKdsStations();
  const [stationId, setStationId] = useState<string | null>(null);
  const [showReady, setShowReady] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const updateStatus = useUpdateTicketStatus();

  const activeStations = useMemo(() => stations.filter((station) => station.isActive), [stations]);
  const station = activeStations.find((item) => item.id === stationId) ?? activeStations[0] ?? null;
  const { data: tickets = [], isLoading: ticketsLoading } = useKdsTickets(station?.id ?? null, showReady);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!accessLoading && access && !access.enabled) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          KDS belum aktif untuk tenant ini. Aktifkan add-on KDS dari Terminal Center.
        </div>
      </div>
    );
  }

  const grouped = COLUMNS.map((column) => ({
    ...column,
    tickets: tickets.filter((ticket) => ticket.status === column.status),
  }));

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kitchen Display</h1>
          <p className="text-xs text-gray-500">Tiket per station, FIFO. Harga & data pelanggan tidak ditampilkan.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih station"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={station?.id ?? ''}
            onChange={(event) => setStationId(event.target.value || null)}
          >
            {activeStations.length === 0 && <option value="">Belum ada station</option>}
            {activeStations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.kind === 'bar' ? 'Bar' : 'Dapur'})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input type="checkbox" checked={showReady} onChange={(event) => setShowReady(event.target.checked)} />
            Tampilkan selesai
          </label>
        </div>
      </div>

      {stationsLoading ? (
        <p className="text-sm text-gray-500">Memuat station…</p>
      ) : activeStations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm font-medium text-gray-700">Belum ada station KDS</p>
          <p className="mt-1 text-xs text-gray-500">Buat station di Pengaturan › Printer (butuh izin printer).</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {grouped.map((column) => (
            <section key={column.status} className={`rounded-xl border-t-4 ${column.tone} p-3`}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">{column.title}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-700">
                  {column.tickets.length}
                </span>
              </header>
              <div className="space-y-3">
                {ticketsLoading && column.status === 'pending' && (
                  <p className="text-xs text-gray-500">Memuat tiket…</p>
                )}
                {column.tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    station={station!}
                    now={now}
                    busy={updateStatus.isPending}
                    onStatus={(status) => updateStatus.mutate({ ticketId: ticket.id, status })}
                  />
                ))}
                {!ticketsLoading && column.tickets.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-400">
                    Tidak ada tiket
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
