import { useMemo, useState, useRef } from 'react';
import { useStockList, useStockMovements, useStockIn, useStockOut, useAdjustStock, useExportStock, useImportStock, Stock } from '../hooks/useInventory';
import { useProductList, Product } from '../../products/hooks/useProducts';

type ModalMode = 'in' | 'out' | 'adjust';

interface ModalState {
  mode: ModalMode;
  product: Product;
  stock?: Stock;
}

const STATUS_LABEL: Record<string, string> = {
  in: 'Masuk',
  out: 'Keluar',
  adjustment: 'Penyesuaian',
  reserve: 'Reservasi',
  release: 'Rilis',
};

const PAGE_SIZE = 20;

export default function StockListPage() {
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [adjustSign, setAdjustSign] = useState<'plus' | 'minus'>('plus');
  const [reasonInput, setReasonInput] = useState('');
  const [error, setError] = useState('');

  const { data: stocks = [] } = useStockList();
  const { data: movements = [] } = useStockMovements();
  const { data: productsData } = useProductList({ limit: 500 });
  const products = productsData?.products ?? [];

  const stockInMutation = useStockIn();
  const stockOutMutation = useStockOut();
  const adjustMutation = useAdjustStock();
  const exportMutation = useExportStock();
  const importMutation = useImportStock();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stockMap = useMemo(() => {
    const m: Record<string, Stock> = {};
    for (const s of stocks) m[s.productId] = s;
    return m;
  }, [stocks]);

  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term) && !(p.sku || '').toLowerCase().includes(term)) {
        return false;
      }
      const stock = stockMap[p.id];
      if (lowStockOnly) {
        if (!stock || stock.quantity === 0) return false;
        return stock.quantity <= stock.minLevel;
      }
      return true;
    });
  }, [products, stockMap, search, lowStockOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const lowStockCount = useMemo(
    () => stocks.filter((s) => s.quantity > 0 && s.quantity <= s.minLevel).length,
    [stocks],
  );

  const openModal = (mode: ModalMode, product: Product) => {
    setModal({ mode, product, stock: stockMap[product.id] });
    setQtyInput('');
    setAdjustSign('plus');
    setReasonInput('');
    setError('');
  };

  const submit = () => {
    if (!modal) return;
    const qty = parseInt(qtyInput.replace(/\D/g, ''), 10) || 0;
    setError('');

    if (qty <= 0) {
      setError('Jumlah harus lebih dari 0');
      return;
    }

    const { mode, product } = modal;

    if (mode === 'out' && modal.stock && qty > modal.stock.availableQuantity) {
      setError(`Stok tersedia hanya ${modal.stock.availableQuantity}`);
      return;
    }

    const reason = reasonInput.trim() || defaultReason(mode);

    const onSuccess = () => {
      setModal(null);
    };

    if (mode === 'in') {
      stockInMutation.mutate({ productId: product.id, quantity: qty, reason }, { onSuccess });
    } else if (mode === 'out') {
      stockOutMutation.mutate({ productId: product.id, quantity: qty, reason }, { onSuccess });
    } else {
      adjustMutation.mutate(
        { productId: product.id, delta: adjustSign === 'plus' ? qty : -qty, reason },
        { onSuccess },
      );
    }
  };

  const isPending =
    stockInMutation.isPending || stockOutMutation.isPending || adjustMutation.isPending;

  const handleExport = async () => {
    try {
      const data = await exportMutation.mutateAsync();
      const productData = products;
      const productMapExport: Record<string, Product> = {};
      for (const p of productData) productMapExport[p.id] = p;

      const headers = ['productId', 'productName', 'sku', 'quantity', 'reservedQuantity', 'minLevel', 'maxLevel', 'warehouseId'];
      const rows = data.map((row) => ({
        ...row,
        productName: productMapExport[row.productId]?.name || '',
        sku: productMapExport[row.productId]?.sku || '',
      }));

      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => `"${(r as any)[h] ?? ''}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal export data');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) {
        alert('File CSV kosong atau tidak valid');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
      const productIdIdx = headers.indexOf('productId');
      const quantityIdx = headers.indexOf('quantity');
      const minLevelIdx = headers.indexOf('minLevel');
      const maxLevelIdx = headers.indexOf('maxLevel');

      if (productIdIdx === -1 || quantityIdx === -1) {
        alert('CSV harus memiliki kolom "productId" dan "quantity"');
        return;
      }

      const items = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''));
        return {
          productId: cols[productIdIdx],
          quantity: parseInt(cols[quantityIdx], 10) || 0,
          minLevel: minLevelIdx !== -1 ? parseInt(cols[minLevelIdx], 10) || undefined : undefined,
          maxLevel: maxLevelIdx !== -1 ? parseInt(cols[maxLevelIdx], 10) || undefined : undefined,
        };
      }).filter((item) => item.productId && item.quantity > 0);

      if (items.length === 0) {
        alert('Tidak ada data valid untuk diimport');
        return;
      }

      try {
        const result = await importMutation.mutateAsync({ items });
        alert(`Import selesai: ${result.data.data.imported} berhasil${result.data.data.errors.length > 0 ? `, ${result.data.data.errors.length} gagal` : ''}`);
      } catch {
        alert('Gagal import data');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              {lowStockCount} produk stok rendah
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
          >
            {importMutation.isPending ? 'Importing...' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Cari nama atau SKU..."
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }}
            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
          />
          Hanya stok rendah
        </label>
        <span className="text-sm text-gray-400">{filteredProducts.length} produk</span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Foto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tersedia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  Tidak ada produk ditemukan
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product) => {
                const stock = stockMap[product.id];
                const tracked = stock && stock.quantity > 0;
                const isLow = tracked && stock.quantity <= stock.minLevel;
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {product.imageUrls[0] ? (
                        <img
                          src={product.imageUrls[0]}
                          alt={product.name}
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.src !== window.location.origin + '/placeholder.svg') {
                              img.onerror = null;
                              img.src = '/placeholder.svg';
                            }
                          }}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      {product.description && (
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tracked ? stock.quantity : '∞'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tracked ? stock.availableQuantity : '∞'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tracked ? stock.minLevel : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        !tracked
                          ? 'bg-gray-100 text-gray-500'
                          : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {!tracked ? 'Tidak dilacak' : isLow ? 'Stok rendah' : 'Aman'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openModal('in', product)}
                        className="text-green-600 hover:text-green-900 mr-3"
                      >
                        Masuk
                      </button>
                      <button
                        onClick={() => openModal('out', product)}
                        disabled={!tracked}
                        className="text-orange-600 hover:text-orange-900 mr-3 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Keluar
                      </button>
                      <button
                        onClick={() => openModal('adjust', product)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Sesuaikan
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Movements */}
      <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Riwayat Stok</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referensi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catatan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {movements.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Belum ada riwayat stok
                </td>
              </tr>
            ) : (
              movements.map((m) => {
                const product = productMap[m.productId];
                const isIn = m.type === 'in';
                const isReserve = m.type === 'reserve';
                const isRelease = m.type === 'release';
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(m.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product?.name || m.productId}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        isIn ? 'bg-green-100 text-green-800'
                          : isReserve ? 'bg-purple-100 text-purple-800'
                          : isRelease ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {STATUS_LABEL[m.type] || m.type}
                      </span>
                    </td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm font-semibold ${
                      isIn ? 'text-green-600' : isReserve || isRelease ? 'text-purple-600' : 'text-orange-600'
                    }`}>
                      {isIn ? '+' : isRelease ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      {m.beforeQuantity} → {m.afterQuantity}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-400 font-mono">
                      {m.referenceType || '-'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{m.notes || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Stock action modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">
                {modal.mode === 'in'
                  ? 'Stok Masuk'
                  : modal.mode === 'out'
                    ? 'Stok Keluar'
                    : 'Penyesuaian Stok'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{modal.product.name}</p>
              {modal.stock && (
                <p className="text-xs text-gray-400 mt-1">
                  Stok saat ini: {modal.stock.quantity}
                  {modal.stock.reservedQuantity > 0
                    ? ` (tersedia ${modal.stock.availableQuantity})`
                    : ''}
                </p>
              )}
            </div>

            <div className="p-6 space-y-4">
              {modal.mode === 'adjust' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustSign('plus')}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm ${
                      adjustSign === 'plus' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    + Tambah
                  </button>
                  <button
                    onClick={() => setAdjustSign('minus')}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm ${
                      adjustSign === 'minus' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    - Kurangi
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah *</label>
                <input
                  type="text"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={defaultReason(modal.mode)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={submit}
                disabled={isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                  modal.mode === 'in'
                    ? 'bg-green-600 hover:bg-green-700'
                    : modal.mode === 'out'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'blue-primary hover:opacity-90'
                }`}
              >
                {isPending
                  ? 'Menyimpan...'
                  : modal.mode === 'in'
                    ? 'Simpan Masuk'
                    : modal.mode === 'out'
                      ? 'Simpan Keluar'
                      : 'Simpan Penyesuaian'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultReason(mode: ModalMode): string {
  if (mode === 'in') return 'Restock';
  if (mode === 'out') return 'Penjualan manual';
  return 'Penyesuaian stok';
}
