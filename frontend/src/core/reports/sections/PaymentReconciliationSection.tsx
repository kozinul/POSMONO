import { usePaymentReconciliationReport } from '../hooks/usePaymentReconciliationReport';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface PaymentReconciliationSectionProps {
  today: string;
  recFrom: string;
  recTo: string;
  setRecFrom: (value: string) => void;
  setRecTo: (value: string) => void;
}

export default function PaymentReconciliationSection({ today, recFrom, recTo, setRecFrom, setRecTo }: PaymentReconciliationSectionProps) {
  const { data: reconciliation, isLoading: reconciliationLoading } = usePaymentReconciliationReport(
    recFrom || today,
    recTo || today,
  );
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Rekonsiliasi Pembayaran</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Perbandingan penerimaan (payments) dengan order pada periode tertentu
          </p>
        </div>
        <ExportButtons
          type="payment-reconciliation"
          params={{ dateFrom: recFrom || today, dateTo: recTo || today }}
          disabled={!reconciliation}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={recFrom} onChange={(e) => setRecFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={recTo} onChange={(e) => setRecTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {reconciliationLoading ? (
          <Spinner />
        ) : reconciliation ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Penerimaan</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(reconciliation.totals.paymentTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Order</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(reconciliation.totals.orderTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Selisih</p>
                <p className={`text-xl font-bold ${reconciliation.totals.difference === 0 ? 'text-green-600' : 'text-rose-600'}`}>
                  {formatCurrency(reconciliation.totals.difference)}
                </p>
              </div>
            </div>

            {reconciliation.totals.pendingCount > 0 && (
              <div className="flex justify-between text-sm bg-amber-50 rounded-lg p-3 border border-amber-200">
                <span className="text-amber-700">Transfer menunggu konfirmasi</span>
                <span className="text-amber-800 font-bold">
                  {reconciliation.totals.pendingCount} · {formatCurrency(reconciliation.totals.pendingTotal)}
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Metode</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Penerimaan</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Transaksi</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Order</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Transaksi</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reconciliation.items.map((item) => (
                    <tr key={item.method} className={item.difference === 0 ? '' : 'bg-rose-50/40'}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{paymentMethodLabel(item.method)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.paymentTotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{item.paymentCount}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.orderTotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{item.orderCount}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${item.difference === 0 ? 'text-green-600' : 'text-rose-600'}`}>
                        {item.difference === 0 ? '✓' : formatCurrency(item.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                  <tr>
                    <td className="px-4 py-3 text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(reconciliation.totals.paymentTotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{reconciliation.totals.paymentCount}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(reconciliation.totals.orderTotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{reconciliation.totals.orderCount}</td>
                    <td className={`px-4 py-3 text-right ${reconciliation.totals.difference === 0 ? 'text-green-600' : 'text-rose-600'}`}>
                      {reconciliation.totals.difference === 0 ? '✓' : formatCurrency(reconciliation.totals.difference)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Tidak ada data pada periode ini</p>
        )}
      </div>
    </section>
  );
}
