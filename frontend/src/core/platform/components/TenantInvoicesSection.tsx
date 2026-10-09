import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  usePlatformTenantInvoices,
  usePlatformInvoicePayments,
  usePlatformRecordInvoicePayment,
  usePlatformCancelInvoice,
  type PlatformSubscriptionInvoice,
  type PlatformInvoiceStatus,
  type PlatformInvoiceReferenceType,
} from '../../../@shared/hooks/useSubscriptionInvoices';
import { formatCurrency } from '../../../@shared/utils/format';
import { toast } from '../../../@shared/hooks/useToast';
import { Badge, Modal, inputCls, primaryBtnCls, ghostBtnCls, apiErrorMessage } from './platformUi';

const STATUS_TONE: Record<PlatformInvoiceStatus, 'green' | 'amber' | 'red' | 'gray'> = {
  paid: 'green',
  pending: 'amber',
  overdue: 'red',
  cancelled: 'gray',
};

const STATUS_LABEL: Record<PlatformInvoiceStatus, string> = {
  paid: 'Lunas',
  pending: 'Belum Lunas',
  overdue: 'Jatuh Tempo',
  cancelled: 'Dibatalkan',
};

const REFERENCE_LABEL: Record<PlatformInvoiceReferenceType, string> = {
  plan_assigned: 'Assign Plan',
  plan_changed: 'Ganti Plan',
  renewal: 'Perpanjangan',
  extended: 'Perpanjangan Manual',
};

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'qris', label: 'QRIS' },
  { value: 'card', label: 'Kartu Kredit / Debit' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'cash', label: 'Tunai' },
];

function fmtDay(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('id-ID') : '-';
}

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('id-ID') : '-';
}

function PaymentHistoryModal({
  tenantId,
  invoice,
  onClose,
}: {
  tenantId: string;
  invoice: PlatformSubscriptionInvoice;
  onClose: () => void;
}) {
  const { data, isLoading } = usePlatformInvoicePayments(tenantId, invoice.id);
  const attempts = data?.items ?? [];

  return (
    <Modal title={`Riwayat Pembayaran ${invoice.number}`} onClose={onClose} width="max-w-2xl" footer={<button className={ghostBtnCls} onClick={onClose}>Tutup</button>}>
      <div className="px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-gray-500 py-4 text-center">Memuat riwayat...</p>
        ) : attempts.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Belum ada upaya pembayaran untuk tagihan ini.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referensi</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-700 uppercase">{a.method}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{formatCurrency(a.amount)}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{a.gateway?.txId ?? a.number ?? '-'}</td>
                    <td className="px-3 py-2 text-sm">
                      <Badge tone={a.status === 'completed' ? 'green' : a.status === 'failed' ? 'red' : 'gray'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">{fmtDateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RecordPaymentModal({
  tenantId,
  invoice,
  onClose,
}: {
  tenantId: string;
  invoice: PlatformSubscriptionInvoice;
  onClose: () => void;
}) {
  const record = usePlatformRecordInvoicePayment();
  const [method, setMethod] = useState('transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await record.mutateAsync({
        tenantId,
        invoiceId: invoice.id,
        amount: invoice.amount,
        method,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast({ title: `Pembayaran ${invoice.number} berhasil dicatat`, icon: 'success' });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal mencatat pembayaran'));
    }
  };

  return (
    <Modal
      title={`Catat Pembayaran ${invoice.number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostBtnCls} onClick={onClose} disabled={record.isPending}>
            Batal
          </button>
          <button type="submit" form="invoice-pay-form" className={primaryBtnCls} disabled={record.isPending}>
            {record.isPending ? 'Menyimpan...' : 'Konfirmasi Bayar'}
          </button>
        </>
      }
    >
      <form id="invoice-pay-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
        {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Tagihan</span>
            <span className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {REFERENCE_LABEL[invoice.referenceType]} · {fmtDay(invoice.periodStart)} — {fmtDay(invoice.periodEnd)}
          </p>
        </div>
        <div>
          <label htmlFor="invoice-pay-method" className="block text-xs font-semibold text-gray-700 mb-1">Metode Pembayaran</label>
          <select id="invoice-pay-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)} disabled={record.isPending}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invoice-pay-ref" className="block text-xs font-semibold text-gray-700 mb-1">No. Referensi / Bukti (Opsional)</label>
          <input id="invoice-pay-ref" className={inputCls} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Cth: TRF-88912345" disabled={record.isPending} />
        </div>
        <div>
          <label htmlFor="invoice-pay-notes" className="block text-xs font-semibold text-gray-700 mb-1">Catatan (Opsional)</label>
          <textarea id="invoice-pay-notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={record.isPending} />
        </div>
      </form>
    </Modal>
  );
}

export default function TenantInvoicesSection({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = usePlatformTenantInvoices(tenantId);
  const cancelInvoice = usePlatformCancelInvoice();
  const [payInvoice, setPayInvoice] = useState<PlatformSubscriptionInvoice | null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<PlatformSubscriptionInvoice | null>(null);

  const handleCancel = async (invoice: PlatformSubscriptionInvoice) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Batalkan Tagihan?',
      html: `Tagihan <b>${invoice.number}</b> sebesar <b>${formatCurrency(invoice.amount)}</b> akan dibatalkan. Alasan pembatalan :`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Alasan pembatalan (opsional)',
      inputAttributes: { rows: '3' },
      showCancelButton: true,
      confirmButtonText: 'Ya, Batalkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async (reason: string) => {
        try {
          await cancelInvoice.mutateAsync({ tenantId, invoiceId: invoice.id, reason: reason?.trim() || undefined });
          return true;
        } catch (err) {
          Swal.showValidationMessage(apiErrorMessage(err, 'Gagal membatalkan tagihan'));
          return false;
        }
      },
    });
    if (isConfirmed) {
      toast({ title: `Tagihan ${invoice.number} dibatalkan`, icon: 'success' });
    }
  };

  const invoices = data?.items ?? [];
  const isOpenStatus = (s: PlatformInvoiceStatus) => s === 'pending' || s === 'overdue';

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tagihan & Pembayaran</h3>
        <div className="text-xs text-gray-500 space-x-3">
          <span>
            Outstanding: <b className="text-red-600">{formatCurrency(data?.totals.outstanding ?? 0)}</b>
          </span>
          <span>
            Terbayar: <b className="text-green-600">{formatCurrency(data?.totals.paid ?? 0)}</b>
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Memuat tagihan...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada tagihan langganan.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">No. Tagihan</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jenis</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 font-mono">{inv.number}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">{REFERENCE_LABEL[inv.referenceType] ?? inv.referenceType}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {fmtDay(inv.periodStart)} — {fmtDay(inv.periodEnd)}
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</td>
                  <td className="px-3 py-2 text-sm">
                    <Badge tone={STATUS_TONE[inv.status] ?? 'gray'}>{STATUS_LABEL[inv.status] ?? inv.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-sm text-right space-x-2 whitespace-nowrap">
                    {isOpenStatus(inv.status) ? (
                      <>
                        <button
                          onClick={() => setPayInvoice(inv)}
                          className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        >
                          Catat Pembayaran
                        </button>
                        <button
                          onClick={() => handleCancel(inv)}
                          disabled={cancelInvoice.isPending}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 disabled:opacity-50"
                        >
                          Batalkan
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Selesai</span>
                    )}
                    <button
                      onClick={() => setHistoryInvoice(inv)}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      Pembayaran
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payInvoice && <RecordPaymentModal tenantId={tenantId} invoice={payInvoice} onClose={() => setPayInvoice(null)} />}
      {historyInvoice && <PaymentHistoryModal tenantId={tenantId} invoice={historyInvoice} onClose={() => setHistoryInvoice(null)} />}
    </div>
  );
}
