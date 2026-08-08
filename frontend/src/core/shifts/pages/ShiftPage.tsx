import { useState } from 'react';
import { useShifts, useOpenShift, useOpenShiftMutation, useCloseShiftMutation, type Shift } from '../hooks/useShift';
import { formatCurrency } from '../../../@shared/utils/format';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('id-ID') : '-';
}

function expectedCashOf(shift: Shift): number {
  return shift.expectedCash ?? (shift.openingBalance + shift.cashSales - shift.totalCashPickups);
}

function ShiftModal({ isOpen, onClose, onOpen, isPending }: { isOpen: boolean; onClose: () => void; onOpen: (balance: number) => void; isPending: boolean }) {
  const [balance, setBalance] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Open Register</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
          <input
            type="number"
            min={0}
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-medium"
            autoFocus
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onOpen(balance)} disabled={balance < 0 || isPending} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{isPending ? 'Opening...' : 'Open Shift'}</button>
        </div>
      </div>
    </div>
  );
}

function CloseShiftModal({ isOpen, shift, onClose, onCloseShift, isPending }: { isOpen: boolean; shift: Shift | null; onClose: () => void; onCloseShift: (id: string, balance: number) => void; isPending: boolean }) {
  const [balance, setBalance] = useState(0);

  if (!isOpen || !shift) return null;

  const expectedCash = expectedCashOf(shift);
  const difference = balance - expectedCash;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Close Shift</h2>
        <p className="text-sm text-gray-500 mb-4">
          Opened: {formatDate(shift.openedAt)}
          <br />
          Opening Balance: {formatCurrency(shift.openingBalance)}
        </p>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Cash Sales</span>
            <span className="font-medium text-gray-900">{formatCurrency(shift.cashSales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Non-Cash Sales</span>
            <span className="font-medium text-gray-900">{formatCurrency(shift.nonCashSales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cash Pickups</span>
            <span className="font-medium text-gray-900">{formatCurrency(shift.totalCashPickups)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1">
            <span className="text-gray-700 font-medium">Expected Cash</span>
            <span className="font-semibold text-gray-900">{formatCurrency(expectedCash)}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Physical Cash</label>
          <input
            type="number"
            min={0}
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-medium"
            autoFocus
          />
          <p className={`mt-2 text-sm font-medium ${difference < 0 ? 'text-red-600' : difference > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            Difference: {formatCurrency(difference)}
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onCloseShift(shift.id, balance)} disabled={balance < 0 || isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{isPending ? 'Closing...' : 'Close Shift'}</button>
        </div>
      </div>
    </div>
  );
}

function CloseoutSummaryModal({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  if (!shift) return null;

  const expectedCash = expectedCashOf(shift);
  const difference = shift.difference ?? (shift.physicalCash != null ? shift.physicalCash - expectedCash : 0);

  const handlePrint = () => {
    const rows = (shift.paymentBreakdown ?? [])
      .map((p) => `<tr><td>${p.method.toUpperCase()}</td><td style="text-align:right">${formatCurrency(p.amount)}</td></tr>`)
      .join('');
    const pickups = (shift.cashPickups ?? [])
      .map((p) => `<tr><td>${new Date(p.pickedAt).toLocaleString('id-ID')}</td><td>${p.reason}</td><td style="text-align:right">${formatCurrency(p.amount)}</td></tr>`)
      .join('');
    const carried = (shift.carriedOverBills ?? [])
      .map((b) => `<tr><td>${b.orderNumber}</td><td>${b.cashierName || 'Kasir'}</td><td style="text-align:right">${formatCurrency(b.total)}</td></tr>`)
      .join('');

    const win = window.open('', '_blank', 'width=520,height=760');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Shift Closeout</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 6px; }
  th { text-align: left; border-bottom: 1px solid #ccc; }
  .meta { color: #555; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .total { font-weight: 700; }
  .diff-neg { color: #b91c1c; }
  .diff-pos { color: #b45309; }
</style></head><body>
<h1>Laporan Penutupan Shift</h1>
<div class="meta">Dibuka: ${formatDate(shift.openedAt)}<br>Ditutup: ${formatDate(shift.closedAt)}</div>
<h2>Penjualan</h2>
<div class="row"><span>Total Transaksi</span><span>${shift.totalTransactions}</span></div>
<div class="row"><span>Total Penjualan</span><span>${formatCurrency(shift.totalSales)}</span></div>
<div class="row"><span>Tunai</span><span>${formatCurrency(shift.cashSales)}</span></div>
<div class="row"><span>Non-Tunai</span><span>${formatCurrency(shift.nonCashSales)}</span></div>
<h2>Rekonsiliasi Kas</h2>
<div class="row"><span>Saldo Awal</span><span>${formatCurrency(shift.openingBalance)}</span></div>
<div class="row"><span>Cash Pickup</span><span>${formatCurrency(shift.totalCashPickups)}</span></div>
<div class="row total"><span>Kas Diharapkan (Expected)</span><span>${formatCurrency(expectedCash)}</span></div>
<div class="row total"><span>Kas Fisik (Physical)</span><span>${formatCurrency(shift.physicalCash ?? 0)}</span></div>
<div class="row total ${difference < 0 ? 'diff-neg' : difference > 0 ? 'diff-pos' : ''}"><span>Selisih</span><span>${formatCurrency(difference)}</span></div>
${pickups ? `<h2>Cash Pickups</h2><table><tr><th>Waktu</th><th>Alasan</th><th style="text-align:right">Jumlah</th></tr>${pickups}</table>` : ''}
${carried ? `<h2>Bill Diteruskan ke Shift Berikutnya</h2><table><tr><th>Bill</th><th>Kasir</th><th style="text-align:right">Total</th></tr>${carried}</table>` : ''}
${rows ? `<h2>Breakdown Pembayaran</h2><table><tr><th>Metode</th><th style="text-align:right">Jumlah</th></tr>${rows}</table>` : ''}
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Laporan Penutupan Shift</h2>
          <button onClick={handlePrint} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Print
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Dibuka: {formatDate(shift.openedAt)}
          <br />
          Ditutup: {formatDate(shift.closedAt)}
        </p>

        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-2 mt-4">Penjualan</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total Transaksi</span><span className="font-medium">{shift.totalTransactions}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total Penjualan</span><span className="font-medium">{formatCurrency(shift.totalSales)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tunai</span><span className="font-medium">{formatCurrency(shift.cashSales)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Non-Tunai</span><span className="font-medium">{formatCurrency(shift.nonCashSales)}</span></div>
        </div>

        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-2 mt-4">Rekonsiliasi Kas</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Saldo Awal</span><span className="font-medium">{formatCurrency(shift.openingBalance)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Cash Pickup</span><span className="font-medium">{formatCurrency(shift.totalCashPickups)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1"><span className="text-gray-700 font-medium">Kas Diharapkan</span><span className="font-semibold">{formatCurrency(expectedCash)}</span></div>
          <div className="flex justify-between"><span className="text-gray-700 font-medium">Kas Fisik</span><span className="font-semibold">{formatCurrency(shift.physicalCash ?? 0)}</span></div>
          <div className={`flex justify-between border-t border-gray-200 pt-1 font-semibold ${difference < 0 ? 'text-red-600' : difference > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            <span>Selisih</span><span>{formatCurrency(difference)}</span>
          </div>
        </div>

        {(shift.cashPickups ?? []).length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-2 mt-4">Cash Pickups</h3>
            <div className="space-y-1 text-sm">
              {shift.cashPickups.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">{p.reason}</span>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(shift.paymentBreakdown ?? []).length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-2 mt-4">Breakdown Pembayaran</h3>
            <div className="space-y-1 text-sm">
              {shift.paymentBreakdown.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">{p.method.toUpperCase()}</span>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(shift.carriedOverBills ?? []).length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-2 mt-4">
              Bill Diteruskan ke Shift Berikutnya
            </h3>
            <div className="space-y-1 text-sm">
              {shift.carriedOverBills.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">
                    {b.orderNumber}
                    <span className="block text-xs text-gray-400">{b.cashierName || 'Kasir'}</span>
                  </span>
                  <span className="font-medium">{formatCurrency(b.total)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftPage() {
  const [showOpen, setShowOpen] = useState(false);
  const [closeShift, setCloseShift] = useState<Shift | null>(null);
  const [closedShift, setClosedShift] = useState<Shift | null>(null);

  const { data: shifts, isLoading } = useShifts();
  const { data: openShift } = useOpenShift();
  const openMutation = useOpenShiftMutation();
  const closeMutation = useCloseShiftMutation();

  const handleOpen = (balance: number) => {
    openMutation.mutate({ openingBalance: balance });
    setShowOpen(false);
  };

  const handleClose = (shiftId: string, closingBalance: number) => {
    closeMutation.mutate(
      { shiftId, closingBalance },
      { onSuccess: (data) => setClosedShift(data) },
    );
    setCloseShift(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
        {!openShift && (
          <button
            onClick={() => setShowOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            Open Register
          </button>
        )}
      </div>

      {openShift && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                Shift Open
              </span>
              <p className="text-sm text-green-700 mt-1">
                Opened: {formatDate(openShift.openedAt)} &middot;
                Balance: {formatCurrency(openShift.openingBalance)} &middot;
                Expected Cash: {formatCurrency(expectedCashOf(openShift))}
              </p>
            </div>
            <button
              onClick={() => setCloseShift(openShift)}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
            >
              Close Shift
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : shifts && shifts.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opened</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opening</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shift.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatDate(shift.openedAt)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(shift.closedAt)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(shift.openingBalance)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shift.expectedCash != null ? formatCurrency(shift.expectedCash) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shift.closingBalance != null ? formatCurrency(shift.closingBalance) : '-'}
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium ${
                    shift.difference === null ? 'text-gray-400' : shift.difference < 0 ? 'text-red-600' : shift.difference > 0 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {shift.difference === null ? '-' : formatCurrency(shift.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-gray-500">No shifts yet</div>
        )}
      </div>

      <ShiftModal
        isOpen={showOpen}
        onClose={() => setShowOpen(false)}
        onOpen={handleOpen}
        isPending={openMutation.isPending}
      />
      <CloseShiftModal
        isOpen={!!closeShift}
        shift={closeShift}
        onClose={() => setCloseShift(null)}
        onCloseShift={handleClose}
        isPending={closeMutation.isPending}
      />
      <CloseoutSummaryModal
        shift={closedShift}
        onClose={() => setClosedShift(null)}
      />
    </div>
  );
}
