import { Fragment, useMemo } from 'react';
import { useInventorySummaryReport } from '../hooks/useInventorySummaryReport';
import ExportButtons from '../components/ExportButtons';
import Spinner from '../components/Spinner';
import { formatCurrency } from '../../../@shared/utils/format';
import { inputCls, labelCls } from '../components/reportUi';

interface InventorySummarySectionProps {
  today: string;
  invFrom: string;
  invTo: string;
  setInvFrom: (value: string) => void;
  setInvTo: (value: string) => void;
}

export default function InventorySummarySection({ today, invFrom, invTo, setInvFrom, setInvTo }: InventorySummarySectionProps) {

  const { data: inventory, isLoading: inventoryLoading } = useInventorySummaryReport(
    invFrom || today,
    invTo || today,
  );

  const inventoryGroups = useMemo(() => {
    if (!inventory) return [];
    const map = new Map<string, typeof inventory.items>();
    for (const it of inventory.items) {
      const arr = map.get(it.productId) ?? [];
      arr.push(it);
      map.set(it.productId, arr);
    }
    return Array.from(map.values()).map((rows) => {
      const first = rows[0];
      return {
        productId: first.productId,
        productName: first.productName || '(tanpa nama)',
        sku: first.sku,
        categoryName: first.categoryName,
        rows,
        quantity: rows.reduce((s, r) => s + r.quantity, 0),
        reserved: rows.reduce((s, r) => s + r.reservedQuantity, 0),
        available: rows.reduce((s, r) => s + r.availableQuantity, 0),
        value: rows.reduce((s, r) => s + r.value, 0),
        openingQuantity: rows.reduce((s, r) => s + r.openingQuantity, 0),
        openingValue: rows.reduce((s, r) => s + r.openingValue, 0),
        movements: rows.reduce(
          (s, r) => ({
            in: s.in + r.movements.in,
            out: s.out + r.movements.out,
            void: s.void + r.movements.void,
          }),
          { in: 0, out: 0, void: 0 },
        ),
      };
    });
  }, [inventory]);
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Ringkasan Stok</h2>
          <p className="text-sm text-gray-400 mt-0.5">Kondisi stok saat ini (per gudang) + saldo awal &amp; pergerakan pada periode</p>
        </div>
        <ExportButtons
          type="inventory-summary"
          params={{ dateFrom: invFrom || today, dateTo: invTo || today }}
          disabled={!inventory || inventory.items.length === 0}
        />
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-4">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={invFrom} onChange={(e) => setInvFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={invTo} onChange={(e) => setInvTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {inventoryLoading ? (
          <Spinner />
        ) : inventory && inventory.items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Nilai Stok</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(inventory.totals.totalValue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Unit</p>
                <p className="text-xl font-bold text-gray-900">{inventory.totals.totalItems.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Tersedia</p>
                <p className="text-xl font-bold text-gray-900">{inventory.totals.totalAvailable.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Produk Menipis</p>
                <p className={`text-xl font-bold ${inventory.lowStockCount > 0 ? 'text-rose-600' : 'text-gray-900'}`}>{inventory.lowStockCount}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Produk</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Gudang</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Awal</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Stok</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Reserved</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Tersedia</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Min</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">HPP</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Nilai Awal</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Nilai</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryGroups.map((g) => (
                    <Fragment key={g.productId}>
                      <tr className="bg-blue-50/50">
                        <td className="px-4 py-3 text-gray-900 font-semibold">
                          {g.productName}
                          {g.sku && <span className="text-gray-400 font-normal"> ({g.sku})</span>}
                          {g.categoryName && <span className="text-gray-400 font-normal"> &middot; {g.categoryName}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400" />
                        <td className="px-4 py-3 text-right text-gray-400">{g.openingQuantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">{g.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{g.reserved}</td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">{g.available}</td>
                        <td className="px-4 py-3 text-right text-gray-400" />
                        <td className="px-4 py-3 text-right text-gray-400" />
                        <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(g.openingValue)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-bold">{formatCurrency(g.value)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {(g.movements.in > 0 || g.movements.out > 0) && (
                            <span>Masuk {g.movements.in} &middot; Keluar {g.movements.out}{g.movements.void > 0 ? ` · Void ${g.movements.void}` : ''}</span>
                          )}
                        </td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={`${r.productId}-${r.warehouseId}`} className="hover:bg-gray-50">
                          <td />
                          <td className="px-4 py-2 pl-10 text-gray-600">{r.warehouseName || r.warehouseId}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{r.openingQuantity}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{r.quantity}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{r.reservedQuantity}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{r.availableQuantity}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{r.minLevel}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(r.costPrice)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(r.openingValue)}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.value)}</td>
                          <td className="px-4 py-2">
                            {r.lowStock && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Menipis</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
                  <tr>
                    <td className="px-4 py-3 text-gray-900">Total</td>
                    <td />
                    <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalOpeningItems}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalItems}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalReserved}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{inventory.totals.totalAvailable}</td>
                    <td className="px-4 py-3 text-right text-gray-400" />
                    <td className="px-4 py-3 text-right text-gray-400" />
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(inventory.totals.totalOpeningValue)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(inventory.totals.totalValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Belum ada data stok</p>
        )}
      </div>
    </section>
  );
}
