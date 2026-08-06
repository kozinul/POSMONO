import { useState } from 'react';
import { useDailyReport, useOrders, useVoidOrder } from '../../orders/hooks/useOrders';
import { useReportExport } from '../../reports/hooks/useReportExport';
import { useOpenShift, useOpenShiftMutation, useCloseShiftMutation } from '../../shifts/hooks/useShift';
import { useAuthStore, hasPermission } from '../../../@shared/hooks/useAuth';
import { VOID_ORDER_PERMISSION } from '../../../@shared/utils/permissions';
import { formatIDR } from '../utils/money';
import { toast } from '../../../@shared/hooks/useToast';
import { PosVoidModal } from '../components/PosVoidModal';

interface PosActionPanelProps {
  openBill: () => void;
  saveBill: () => Promise<boolean>;
  closeActiveBill: () => void;
  hasItems: boolean;
  activeBillNumber?: string | null;
}

const today = new Date().toISOString().split('T')[0];

export function PosActionPanel(props: PosActionPanelProps) {
  const { openBill, saveBill, closeActiveBill, hasItems, activeBillNumber } = props;

  const [open, setOpen] = useState(false);
  const [paidOrderSelectOpen, setPaidOrderSelectOpen] = useState(false);
  const [paidSearch, setPaidSearch] = useState('');
  const [voidOrderTarget, setVoidOrderTarget] = useState<{ id: string; orderNumber: string } | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const canVoidSelf = hasPermission(currentUser, VOID_ORDER_PERMISSION);

  const { data: openShift } = useOpenShift();
  const openShiftMut = useOpenShiftMutation();
  const closeShiftMut = useCloseShiftMutation();

  const { data: daily } = useDailyReport(today);
  const { data: paidOrdersRes } = useOrders({ status: 'paid', limit: 100 });
  const paidOrders = paidOrdersRes?.data ?? [];
  const voidOrderMutate = useVoidOrder();
  const exportReport = useReportExport();

  const handleOpenShift = async () => {
    const balance = window.prompt('Saldo buka kasir (Rp):', '0') ?? '0';
    await openShiftMut.mutateAsync({ openingBalance: Number(balance) || 0 });
    toast({ title: 'Shift dibuka', icon: 'success' });
  };

  const handleCloseShift = async () => {
    if (!openShift) return;
    const balance = window.prompt('Saldo tutup kasir (Rp):', String(openShift.closingBalance ?? 0)) ?? '0';
    await closeShiftMut.mutateAsync({ shiftId: openShift.id, closingBalance: Number(balance) || 0 });
    toast({ title: 'Shift ditutup', icon: 'success' });
  };

  const submitVoidOrder = async (reason: string, managerPin?: string) => {
    if (!voidOrderTarget) return;
    setVoidError(null);
    try {
      await voidOrderMutate.mutateAsync({
        orderId: voidOrderTarget.id,
        reason,
        voidedByName: currentUser?.displayName || 'Kasir',
        managerPin,
      });
      setVoidOrderTarget(null);
      toast({ title: 'Order berhasil divoid', icon: 'success' });
    } catch (err: any) {
      setVoidError(err?.response?.data?.error?.message || 'Gagal memvoid order');
    }
  };

  const handleExport = (format: 'pdf' | 'xlsx') => {
    exportReport.mutate({ type: 'daily', params: { date: today }, format });
  };

  return (
    <>
      <div className="fixed left-6 top-[88px] z-[50] flex flex-col items-start">
        {open && (
          <div
            className="fixed inset-0 bg-black/30 z-[49]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
        <div
          className={`z-[51] mb-3 rounded-xl bg-white border border-gray-200 shadow-xl transition-all duration-200 origin-top-left ${
            open
              ? 'scale-100 opacity-100 visible w-64 max-h-[70vh] overflow-y-auto'
              : 'scale-95 opacity-0 invisible w-64'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Aksi Kasir</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-1 border-b border-gray-100">
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-gray-500 uppercase">
              Order / Bill
            </p>
            <button
              onClick={openBill}
              disabled={hasItems || !!activeBillNumber}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Buat Bill
            </button>
            <button
              onClick={() => {
                void saveBill();
                setOpen(false);
              }}
              disabled={!activeBillNumber}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Simpan & Tutup
            </button>
            <button
              onClick={() => {
                closeActiveBill();
                setOpen(false);
              }}
              disabled={!activeBillNumber}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Batal Bill
            </button>
            <button
              onClick={() => {
                setPaidOrderSelectOpen(true);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              Void Transaksi
            </button>
          </div>

          <div className="p-3 space-y-1 border-b border-gray-100">
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-gray-500 uppercase">
              Laporan Kasir
            </p>
            {daily ? (
              <div className="px-3 py-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Orders</span>
                  <span className="text-gray-900 font-medium">{daily.totalOrders}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Revenue</span>
                  <span className="text-gray-900 font-medium">Rp {formatIDR(daily.totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Item</span>
                  <span className="text-gray-900 font-medium">{daily.totalItems}</span>
                </div>
              </div>
            ) : (
              <p className="px-3 py-2 text-sm text-gray-400">Memuat...</p>
            )}
            <div className="flex gap-2 px-3 pt-1">
              <button
                onClick={() => handleExport('pdf')}
                className="flex-1 bg-red-600 text-white text-xs py-1.5 rounded hover:bg-red-700"
              >
                PDF
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700"
              >
                Excel
              </button>
            </div>
          </div>

          <div className="p-3 space-y-1">
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-gray-500 uppercase">
              Shift
            </p>
            {openShift ? (
              <>
                <div className="px-3 py-2 text-sm text-gray-700">
                  Shift: <span className="font-medium">terbuka</span>
                </div>
                <button
                  onClick={handleCloseShift}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  Tutup Shift
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenShift}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Buka Shift
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="z-[51] w-14 h-14 rounded-full blue-primary text-white shadow-lg hover:opacity-90 transition flex items-center justify-center"
          title="Aksi kasir"
        >
          <span className="block w-6 h-0.5 bg-white mb-1"></span>
          <span className="block w-6 h-0.5 bg-white mb-1"></span>
          <span className="block w-6 h-0.5 bg-white"></span>
        </button>
      </div>

      {/* Pilih order paid untuk void */}
      {paidOrderSelectOpen && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Pilih Transaksi untuk Void</h3>
              <p className="text-sm text-gray-400 mt-0.5">Order yang sudah selesai (paid).</p>
            </div>
            <div className="p-4">
              <input
                value={paidSearch}
                onChange={(e) => setPaidSearch(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cari nomor order..."
              />
              <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-gray-100">
                {(paidOrders || [])
                  .filter(
                    (o: any) =>
                      !paidSearch.trim() ||
                      (o.orderNumber ?? '').toLowerCase().includes(paidSearch.toLowerCase()),
                  )
                  .slice(0, 50)
                  .map((o: any) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setVoidOrderTarget({ id: o.id, orderNumber: o.orderNumber });
                        setPaidOrderSelectOpen(false);
                        setPaidSearch('');
                      }}
                      className="w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                    >
                      <span className="text-gray-700 font-medium">{o.orderNumber}</span>
                      <span className="text-gray-900">Rp {formatIDR(o.total ?? 0)}</span>
                    </button>
                  ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setPaidOrderSelectOpen(false);
                  setPaidSearch('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi void order */}
      {voidOrderTarget && (
        <PosVoidModal
          title="Void Transaksi"
          description={`Void order ${voidOrderTarget.orderNumber}? Transaksi ini akan dibatalkan.`}
          requiresPin={!canVoidSelf}
          isPending={voidOrderMutate.isPending}
          error={voidError}
          onSubmit={submitVoidOrder}
          onClose={() => {
            setVoidOrderTarget(null);
            setVoidError(null);
          }}
        />
      )}
    </>
  );
}
