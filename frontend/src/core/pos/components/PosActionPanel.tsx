import { useState, useEffect } from 'react';
import { usePOSStore } from '../store/posStore';
import { useOrders, useShiftReport } from '../../orders/hooks/useOrders';
import { useOpenShift,
  useOpenShiftMutation,
  useCloseShiftMutation,
} from '../../shifts/hooks/useShift';
import { useAuthStore, hasPermission } from '../../../@shared/hooks/useAuth';
import { VOID_ORDER_PERMISSION } from '../../../@shared/utils/permissions';
import { formatIDR } from '../utils/money';
import { toast } from '../../../@shared/hooks/useToast';
import Swal from 'sweetalert2';
import { ReportPrintModal } from './ReportPrintModal';
import { OpenShiftModal } from './OpenShiftModal';

interface PosActionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewTransaction?: (order: any) => void;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    paid: { label: 'Lunas', classes: 'bg-green-100 text-green-700' },
    completed: { label: 'Selesai', classes: 'bg-green-100 text-green-700' },
    held: { label: 'Draft', classes: 'bg-yellow-100 text-yellow-700' },
    draft: { label: 'Draft', classes: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Terkonfirmasi', classes: 'bg-blue-100 text-blue-700' },
    preparing: { label: 'Dibuat', classes: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Batal', classes: 'bg-red-100 text-red-700' },
    refunded: { label: 'Refund', classes: 'bg-red-100 text-red-700' },
    voided: { label: 'Void', classes: 'bg-red-100 text-red-700' },
    'partially-voided': { label: 'Sebagian Void', classes: 'bg-orange-100 text-orange-700' },
  };
  return map[status] ?? { label: status ?? '—', classes: 'bg-gray-100 text-gray-600' };
}

export function PosActionPanel(props: PosActionPanelProps) {
  const { open, onOpenChange, onViewTransaction } = props;

  const [paidOrderSelectOpen, setPaidOrderSelectOpen] = useState(false);
  const [paidSearch, setPaidSearch] = useState('');
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [reportModal, setReportModal] = useState<null | 'transactions' | 'receipt'>(null);
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false);

  const { heldOrders, tapBill, dismissHeldOrder } = usePOSStore();

  const currentUser = useAuthStore((s) => s.user);
  const canVoidSelf = hasPermission(currentUser, VOID_ORDER_PERMISSION);

  const { data: openShift } = useOpenShift();
  const closeShiftMut = useCloseShiftMutation();

  const today = new Date().toISOString().split('T')[0];

  const { data: todayOrdersRes, refetch: refetchTodayOrders } = useOrders({ dateFrom: today, dateTo: today, limit: 100 });
  const todayOrders = todayOrdersRes?.data ?? [];
  const { data: shiftReport, refetch: refetchShiftReport } = useShiftReport(openShift?.id);

  useEffect(() => {
    if (!open) return;
    refetchTodayOrders();
    refetchShiftReport();
  }, [open, refetchTodayOrders, refetchShiftReport]);

  const handleOpenShift = () => {
    setOpenShiftModalOpen(true);
  };

  const handleCloseShift = async () => {
    if (!openShift) return;
    const expectedCash =
      openShift.expectedCash ??
      openShift.openingBalance + openShift.cashSales - openShift.totalCashPickups;

    await Swal.fire({
      title: 'Tutup Shift',
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.9">
          <div style="display:flex;justify-content:space-between">
            <span style="color:#6b7280">Kas Diharapkan</span>
            <b>Rp ${formatIDR(expectedCash)}</b>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#6b7280">Penjualan Tunai</span>
            <b>Rp ${formatIDR(openShift.cashSales ?? 0)}</b>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#6b7280">Non-Tunai</span>
            <b>Rp ${formatIDR(openShift.nonCashSales ?? 0)}</b>
          </div>
        </div>
      `,
      input: 'text',
      inputLabel: 'Saldo Tutup Kasir (Rp)',
      inputPlaceholder: '0',
      inputValue: String(openShift.closingBalance ?? 0),
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Tutup Shift',
      cancelButtonText: 'Batal',
      showLoaderOnConfirm: true,
      inputValidator: (val: string) => {
        const num = Number((val || '').replace(/\D/g, ''));
        if (!String(val).trim() || !Number.isFinite(num) || num < 0) return 'Saldo tidak valid';
        return null;
      },
      preConfirm: async (val: string) => {
        const cash = Number((val || '').replace(/\D/g, '')) || 0;
        try {
          await closeShiftMut.mutateAsync({ shiftId: openShift.id, closingBalance: cash });
          toast({ title: 'Shift ditutup', icon: 'success' });
          return true;
        } catch (err: any) {
          const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Gagal menutup shift';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    });
  };

  const handleViewTransaction = (order: any) => {
    if (onViewTransaction) {
      onViewTransaction(order);
      onOpenChange(false);
    }
  };

  const shiftSales = shiftReport?.sales;
  const shiftOrders = shiftReport?.orders ?? [];
  const inheritedCarriedBills = shiftReport?.inheritedCarriedBills ?? [];
  const shiftBreakdown = (shiftSales?.paymentBreakdown ?? []).reduce(
    (acc: Record<string, number>, p) => {
      acc[p.method] = (acc[p.method] ?? 0) + p.amount;
      return acc;
    },
    {},
  );
  const shiftTotalSales = shiftSales?.totalSales ?? openShift?.totalSales ?? 0;
  const shiftTotalTransactions =
    shiftSales?.totalTransactions ?? openShift?.totalTransactions ?? 0;

  return (
    <>
      {open && (
        <div className="fixed left-6 top-[140px] z-[50] flex flex-col items-start">
          <div
            className="fixed inset-0 bg-black/30 z-[49]"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <div
            className="z-[51] mb-3 rounded-xl bg-white border border-gray-200 shadow-xl transition-all duration-200 origin-top-left scale-100 opacity-100 visible w-64 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Aksi Kasir</h3>
              <button
                onClick={() => onOpenChange(false)}
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
                onClick={() => {
                  setBillModalOpen(true);
                  onOpenChange(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-between"
              >
                <span>Daftar Bill</span>
                {heldOrders.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {heldOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setPaidSearch('');
                  setPaidOrderSelectOpen(true);
                  refetchTodayOrders();
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Daftar Transaksi
              </button>
            </div>

            <div className="p-3 space-y-1 border-b border-gray-100">
              <p className="px-2 pt-1 pb-1 text-xs font-medium text-gray-500 uppercase">
                Laporan Kasir
              </p>
              {openShift ? (
                <>
                  <div className="px-3 py-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Transaksi</span>
                      <span className="text-gray-900 font-medium">{shiftTotalTransactions}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Penjualan</span>
                      <span className="text-gray-900 font-medium">
                        Rp {formatIDR(shiftTotalSales)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tunai</span>
                      <span className="text-gray-900 font-medium">
                        Rp {formatIDR(shiftSales?.cashSales ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Non-Tunai</span>
                      <span className="text-gray-900 font-medium">
                        Rp {formatIDR(shiftSales?.nonCashSales ?? 0)}
                      </span>
                    </div>
                  </div>
                  <div className="px-3 pt-2 space-y-1">
                    <button
                      onClick={() => {
                        refetchShiftReport();
                        setReportModal('transactions');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                    >
                      Laporan Transaksi (Shift)
                    </button>
                    <button
                      onClick={() => {
                        refetchShiftReport();
                        setReportModal('receipt');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                    >
                      Laporan Penerimaan Kasir
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-3 py-2 space-y-1">
                  <p className="text-sm text-gray-400">
                    Buka shift terlebih dahulu untuk melihat laporan kasir per shift.
                  </p>
                  <button
                    onClick={handleOpenShift}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    Buka Shift
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 space-y-1">
              <p className="px-2 pt-1 pb-1 text-xs font-medium text-gray-500 uppercase">Shift</p>
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
        </div>
      )}

      {/* Daftar transaksi hari ini */}
      {paidOrderSelectOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4"
          onClick={() => {
            setPaidOrderSelectOpen(false);
            setPaidSearch('');
          }}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Daftar Transaksi</h3>
                <p className="text-sm text-gray-400 mt-0.5">Order pada hari dan shift yang sama.</p>
              </div>
              <button
                onClick={() => {
                  setPaidOrderSelectOpen(false);
                  setPaidSearch('');
                }}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <input
                value={paidSearch}
                onChange={(e) => setPaidSearch(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cari nomor order..."
              />
              <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-gray-100">
                {(() => {
                  const filtered = (todayOrders || [])
                    .filter(
                      (o: any) =>
                        !paidSearch.trim() ||
                        (o.orderNumber ?? '').toLowerCase().includes(paidSearch.toLowerCase()),
                    )
                    .slice(0, 50);

                  if (filtered.length === 0) {
                    return (
                      <p className="text-center text-sm text-gray-400 py-4">
                        Tidak ada transaksi hari ini.
                      </p>
                    );
                  }

                  return filtered.map((o: any) => {
                    const badge = statusBadge(o.status);
                    return (
                      <button
                        key={o.id}
                        onClick={() => handleViewTransaction(o)}
                        className="w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                      >
                        <span className="flex flex-col items-start">
                          <span className="text-gray-700 font-medium">{o.orderNumber}</span>
                          <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </span>
                        <span className="text-gray-900">Rp {formatIDR(o.total ?? 0)}</span>
                      </button>
                    );
                  });
                })()}
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

      {/* Daftar Bill modal */}
      {billModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Daftar Bill</h3>
              <input
                type="text"
                placeholder="Cari nomor bill..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-primary"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {heldOrders.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Tidak ada bill yang tersimpan.</p>
              ) : (
                heldOrders
                  .filter(
                    (b) =>
                      !billSearch ||
                      b.orderNumber.toLowerCase().includes(billSearch.toLowerCase()),
                  )
                  .map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Bill {bill.orderNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {bill.items.length} item · {formatIDR(bill.total)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            tapBill(bill);
                            setBillModalOpen(false);
                            onOpenChange(false);
                          }}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Buka
                        </button>
                        <button
                          onClick={() => dismissHeldOrder(bill.id)}
                          className="px-1 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                          title="Buang"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setBillModalOpen(false);
                  setBillSearch('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportPrintModal
        open={reportModal !== null}
        variant={reportModal ?? 'transactions'}
        orders={shiftOrders}
        paymentBreakdown={shiftBreakdown}
        totalOrders={shiftTotalTransactions}
        totalRevenue={shiftTotalSales}
        totalRounding={shiftReport?.totalRounding ?? 0}
        carriedOverBills={reportModal === 'receipt' ? inheritedCarriedBills : undefined}
        onClose={() => setReportModal(null)}
      />

      {openShiftModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <OpenShiftModal onClose={() => setOpenShiftModalOpen(false)} />
        </div>
      )}
    </>
  );
}
