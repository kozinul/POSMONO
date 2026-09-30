import { Fragment } from 'react';
import { useCashierReceiptsReport } from '../hooks/useCashierReceiptsReport';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface CashierReceiptsSectionProps {
  today: string;
  cashierReceiptsFrom: string;
  cashierReceiptsTo: string;
  setCashierReceiptsFrom: (value: string) => void;
  setCashierReceiptsTo: (value: string) => void;
}

export default function CashierReceiptsSection({ today, cashierReceiptsFrom, cashierReceiptsTo, setCashierReceiptsFrom, setCashierReceiptsTo }: CashierReceiptsSectionProps) {
  const { data: cashierReceipts, isLoading: cashierReceiptsLoading } = useCashierReceiptsReport(
    cashierReceiptsFrom || today,
    cashierReceiptsTo || today,
  );
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Penerimaan per Kasir</h2>
          <p className="text-sm text-gray-400 mt-0.5">Rincian penerimaan tiap kasir menurut metode pembayaran</p>
        </div>
        <ExportButtons
          type="cashier-receipts"
          params={{ dateFrom: cashierReceiptsFrom || today, dateTo: cashierReceiptsTo || today }}
          disabled={!cashierReceipts || cashierReceipts.cashiers.length === 0}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={cashierReceiptsFrom} onChange={(e) => setCashierReceiptsFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={cashierReceiptsTo} onChange={(e) => setCashierReceiptsTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {cashierReceiptsLoading ? (
          <Spinner />
        ) : cashierReceipts && cashierReceipts.cashiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Kasir</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Metode</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Transaksi</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Penerimaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cashierReceipts.cashiers.map((c) => (
                  <Fragment key={c.cashierId}>
                    <tr className="bg-blue-50/50">
                      <td className="px-4 py-3 text-gray-900 font-semibold">{c.cashierName}</td>
                      <td className="px-4 py-3 text-gray-400" />
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">{c.totalTransactions}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-bold">
                        {formatCurrency(c.total)}
                      </td>
                    </tr>
                    {c.methods.map((m) => (
                      <tr key={`${c.cashierId}-${m.method}`}>
                        <td />
                        <td className="px-4 py-2 pl-10 text-gray-600">{paymentMethodLabel(m.method)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{m.count}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(m.total)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td />
                  <td className="px-4 py-3 text-right text-gray-900">{cashierReceipts.totals.totalTransactions}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(cashierReceipts.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Tidak ada penerimaan pada periode ini</p>
        )}
      </div>
    </section>
  );
}
