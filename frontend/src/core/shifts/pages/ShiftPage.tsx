import { useState } from 'react';
import { useShifts, useOpenShift, useOpenShiftMutation, useCloseShiftMutation } from '../hooks/useShift';
import { formatCurrency } from '../../../@shared/utils/format';

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

function CloseShiftModal({ isOpen, shift, onClose, onCloseShift, isPending }: { isOpen: boolean; shift: any; onClose: () => void; onCloseShift: (id: string, balance: number) => void; isPending: boolean }) {
  const [balance, setBalance] = useState(0);

  if (!isOpen || !shift) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Close Shift</h2>
        <p className="text-sm text-gray-500 mb-4">
          Opened: {new Date(shift.openedAt).toLocaleString('id-ID')}
          <br />
          Opening Balance: {formatCurrency(shift.openingBalance)}
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Closing Balance</label>
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
          <button onClick={() => onCloseShift(shift.id, balance)} disabled={balance < 0 || isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{isPending ? 'Closing...' : 'Close Shift'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftPage() {
  const [showOpen, setShowOpen] = useState(false);
  const [closeShift, setCloseShift] = useState<any>(null);

  const { data: shifts, isLoading } = useShifts();
  const { data: openShift } = useOpenShift();
  const openMutation = useOpenShiftMutation();
  const closeMutation = useCloseShiftMutation();

  const handleOpen = (balance: number) => {
    openMutation.mutate({ openingBalance: balance });
    setShowOpen(false);
  };

  const handleClose = (shiftId: string, closingBalance: number) => {
    closeMutation.mutate({ shiftId, closingBalance });
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
                Opened: {new Date(openShift.openedAt).toLocaleString('id-ID')} &middot;
                Balance: {formatCurrency(openShift.openingBalance)}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closing</th>
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
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(shift.openedAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {shift.closedAt ? new Date(shift.closedAt).toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(shift.openingBalance)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shift.closingBalance != null ? formatCurrency(shift.closingBalance) : '-'}
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
    </div>
  );
}
