import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useSalesPerProductReport } from '../hooks/useSalesPerProductReport';
import { formatCurrency } from '../../../@shared/utils/format';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SalesPerProductPage() {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const { data, isLoading } = useSalesPerProductReport(dateFrom, dateTo);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/reports" className="text-sm text-primary-600 hover:text-primary-700">
          &larr; Reports
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Sales per Product</h1>
      </div>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : data && data.rows.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
              {data.rows.map((row) => {
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
              <tr>
                <td />
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{data.summary.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.summary.totalSales)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.summary.dpp)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.summary.serviceCharge)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.summary.tax)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.summary.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Select a date range</p>
      )}
    </div>
  );
}
