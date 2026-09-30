import { Fragment } from 'react';
import { useSalesPerProductReport } from '../hooks/useSalesPerProductReport';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface SalesPerProductSectionProps {
  today: string;
  sppFrom: string;
  sppTo: string;
  setSppFrom: (value: string) => void;
  setSppTo: (value: string) => void;
  expandedProduct: string | null;
  setExpandedProduct: (value: string | null) => void;
}

export default function SalesPerProductSection({ today, sppFrom, sppTo, setSppFrom, setSppTo, expandedProduct, setExpandedProduct }: SalesPerProductSectionProps) {
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

  const { data: spp, isLoading: sppLoading } = useSalesPerProductReport(
    sppFrom || today,
    sppTo || today,
  );
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Penjualan per Produk</h2>
          <p className="text-sm text-gray-400 mt-0.5">Rincian penjualan tiap produk</p>
        </div>
        <ExportButtons
          type="sales-per-product"
          params={{ dateFrom: sppFrom || today, dateTo: sppTo || today }}
          disabled={!spp || spp.rows.length === 0}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={sppFrom} onChange={(e) => setSppFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={sppTo} onChange={(e) => setSppTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {sppLoading ? (
          <Spinner />
        ) : spp && spp.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-8 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Produk</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Total Penjualan</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">DPP</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">SC</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Pajak</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {spp.rows.map((row) => {
                  const isExpanded = expandedProduct === row.productId;
                  const grandTotal = row.totalSales + row.tax + row.serviceCharge;

                  return (
                    <Fragment key={row.productId}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer select-none"
                        onClick={() => setExpandedProduct(isExpanded ? null : row.productId)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            &#9654;
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{row.productName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.totalSales)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.dpp)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.serviceCharge)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.tax)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                      {isExpanded && row.transactions.map((tx, idx) => {
                        const txGrandTotal = tx.unitPrice * tx.quantity + tx.serviceCharge + tx.tax;
                        return (
                          <tr key={`${row.productId}-${idx}`} className="bg-gray-50">
                            <td />
                            <td className="px-4 py-2 pl-10 text-gray-500 text-xs">
                              {tx.orderId}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">{tx.quantity}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">
                              {formatCurrency(tx.unitPrice * tx.quantity)}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatCurrency(tx.dpp)}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatCurrency(tx.serviceCharge)}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">{formatCurrency(tx.tax)}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs font-medium">
                              {formatCurrency(txGrandTotal)}
                            </td>
                          </tr>
                        );
                      })}
                      {isExpanded && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={8} className="px-4 py-1 text-right text-xs text-gray-400">
                            {row.transactions.length} transaksi &middot; {formatDate(row.transactions[0]?.createdAt)}{row.transactions.length > 1 ? ` - ${formatDate(row.transactions[row.transactions.length - 1]?.createdAt)}` : ''}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                {spp.summary.totalRounding !== 0 && (
                  <tr>
                    <td />
                    <td className="px-4 py-2 text-gray-500 font-medium">Pembulatan</td>
                    <td colSpan={5} />
                    <td className="px-4 py-2 text-right text-purple-700">
                      {spp.summary.totalRounding > 0 ? '+' : '-'}{formatCurrency(Math.abs(spp.summary.totalRounding))}
                    </td>
                  </tr>
                )}
                <tr>
                  <td />
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right text-gray-900">{spp.summary.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.totalSales)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.dpp)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.serviceCharge)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.tax)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(spp.summary.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a date range</p>
        )}
      </div>
    </section>
  );
}
