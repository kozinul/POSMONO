import { useRefundReport, refundReference, type RefundRow } from '../../payments/hooks/useRefund';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface RefundsSectionProps {
  today: string;
  refundFrom: string;
  refundTo: string;
  setRefundFrom: (value: string) => void;
  setRefundTo: (value: string) => void;
  setSelectedRefund: (value: RefundRow | null) => void;
}

export default function RefundsSection({ today, refundFrom, refundTo, setRefundFrom, setRefundTo, setSelectedRefund }: RefundsSectionProps) {
  const { data: refunds, isLoading: refundsLoading } = useRefundReport(
    refundFrom || today,
    refundTo || today,
  );
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Refund</h2>
          <p className="text-sm text-gray-400 mt-0.5">Rincian refund transaksi pada periode tertentu</p>
        </div>
        <ExportButtons
          type="refunds"
          params={{ dateFrom: refundFrom || today, dateTo: refundTo || today }}
          disabled={!refunds || refunds.refunds.length === 0}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={refundFrom} onChange={(e) => setRefundFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={refundTo} onChange={(e) => setRefundTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {refundsLoading ? (
          <Spinner />
        ) : refunds && refunds.refunds.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Refund</p>
                <p className="text-xl font-bold text-gray-900">{refunds.totalRefunds}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(refunds.totalAmount)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">No. Order</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Tanggal</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Metode</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Kode Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Kasir</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Refunded By</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Alasan</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Jumlah</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Struk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {refunds.refunds.map((r) => (
                    <tr key={r.refundId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{r.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(r.refundedAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{paymentMethodLabel(r.method)}</td>
                      <td className="px-4 py-3 text-gray-500">{refundReference(r)}</td>
                      <td className="px-4 py-3 text-gray-500">{r.cashierName || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.refundedByName || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={r.reason}>{r.reason || '-'}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedRefund(r)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                        >
                          Struk
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                  <tr>
                    <td className="px-4 py-3 text-gray-900">Total</td>
                    <td colSpan={7} />
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(refunds.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Tidak ada refund pada periode ini</p>
        )}
      </div>
    </section>
  );
}
