import { usePOSStore } from '../store/posStore';
import { formatIDR } from '../utils/money';
import { renderLayoutToHtml } from '../../templates/utils/renderLayoutToHtml';
import { useQueryClient } from '@tanstack/react-query';
import { reprintReceipt } from '../../printing/utils/autoPrint';

function downloadBase64(base64: string, filename: string, mime: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function FallbackFromViewModel({ receipt }: { receipt: Record<string, unknown> }) {
  const vm = receipt.viewModel as any | undefined | null;
  if (!vm) {
    return (
      <div className="p-6 border-b border-gray-100 text-center text-sm text-gray-500">
        Struk tidak tersedia untuk pesanan ini.
      </div>
    );
  }
  const store = vm.store as any;
  const order = vm.order as any;
  const items = (vm.items ?? []) as any[];
  const summary = vm.summary as any;
  const taxes = (summary.taxes ?? []) as any[];
  const payments = (vm.payments ?? []) as any[];
  const promotions = (vm.promotions ?? []) as any[];
  const footer = typeof vm.footer === 'string' ? vm.footer : null;

  return (
    <>
      <div className="p-6 border-b border-gray-100 text-center">
        {store?.logo && (
          <img src={store.logo} alt="Logo" className="h-20 mx-auto mb-2 object-contain" />
        )}
        <h2 className="text-lg font-bold text-gray-800">{store?.name ?? 'Toko'}</h2>
        {store?.outlet && (
          <p className="text-xs text-gray-500 mt-0.5">{store.outlet}</p>
        )}
        {store?.address && (
          <p className="text-xs text-gray-500 mt-0.5">{store.address}</p>
        )}
        {store?.phone && (
          <p className="text-xs text-gray-500 mt-0.5">{store.phone}</p>
        )}
        <div className="my-2 border-t border-gray-100" />
        <p className="text-sm font-semibold text-gray-800">Pesanan {order?.documentNumber}</p>
        {order?.date && (
          <p className="text-xs text-gray-400 mt-0.5">{order.date} {order.time ?? ''}</p>
        )}
        {order?.cashier && (
          <p className="text-xs text-gray-400 mt-0.5">Kasir: {order.cashier}</p>
        )}
      </div>

      <div className="p-6 space-y-3 text-sm">
        {items.map((item, idx) => {
          const isFree = item.isFreeItem === true;
          return (
            <div key={idx} className="flex justify-between">
              <span className="text-gray-700">
                {item.qty}x {item.name}
                {isFree && <span className="ml-1 text-green-600 font-bold">(GRATIS)</span>}
                {item.modifierLines && <div className="block text-xs text-gray-500 font-medium mt-0.5 whitespace-pre-line">{item.modifierLines}</div>}
              </span>
              <span className="font-medium text-gray-800">
                {isFree ? 'GRATIS' : `Rp ${formatIDR(item.totalPrice)}`}
              </span>
            </div>
          );
        })}

        {promotions.length > 0 && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            {promotions.map((promo, i) => (
              <div key={i} className="flex justify-between text-xs text-green-700">
                <span>{promo.name} {promo.code ? `(${promo.code})` : ''}</span>
                <span>-Rp {formatIDR(promo.discount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span>Rp {formatIDR(summary?.subtotal ?? 0)}</span>
          </div>
          {summary && summary.serviceCharge > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Service Charge ({summary.serviceChargeRate}%)</span>
              <span>Rp {formatIDR(summary.serviceCharge)}</span>
            </div>
          )}
          {summary?.dppLabel && summary.dpp > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>{summary.dppLabel}</span>
              <span>Rp {formatIDR(summary.dpp)}</span>
            </div>
          )}
          {taxes.map((tax: any, i: number) => (
            <div key={i} className="flex justify-between text-sm text-gray-500">
              <span>{tax.label}</span>
              <span>Rp {formatIDR(tax.amount)}</span>
            </div>
          ))}
          {summary && summary.rounding !== 0 && (
            <div className="flex justify-between text-sm text-gray-400">
              <span>Pembulatan</span>
              <span>{summary.rounding > 0 ? '+' : ''}Rp {formatIDR(summary.rounding)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
            <span>TOTAL</span>
            <span>Rp {formatIDR(summary?.grandTotal ?? 0)}</span>
          </div>
          <div className="pt-2 border-t border-dashed">
            {payments.map((pay, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-700 font-medium">
                <span>Bayar ({pay.methodLabel}) {pay.referenceLine ? `(${pay.referenceLine})` : ''}</span>
                <span>Rp {formatIDR(pay.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        {footer && <p className="text-center text-xs text-gray-400 pt-4">{footer}</p>}
      </div>
    </>

  );
}

export function ReceiptDisplay() {
  const { receipt, clearCart, openPaymentModal, clearReceipt } = usePOSStore();
  const queryClient = useQueryClient();

  if (!receipt) return null;

  const layoutHtml = receipt.layout ? renderLayoutToHtml(receipt.layout) : null;

  const handleNewOrder = () => {
    if (receipt.hasRemaining) {
      clearReceipt();
      openPaymentModal();
    } else {
      clearCart();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl receipt-print">
        {layoutHtml ? (
          <div className="p-6 border-b border-gray-100">
            <div
              className="font-mono text-xs text-gray-800"
              dangerouslySetInnerHTML={{ __html: layoutHtml }}
            />
            {receipt.templateName && (
              <p className="text-[10px] text-gray-400 text-center mt-3">
                Template: {receipt.templateName}
              </p>
            )}
          </div>
        ) : (
          <FallbackFromViewModel receipt={receipt as unknown as Record<string, unknown>} />
        )}

        <div className="p-6 pt-0 flex gap-3 receipt-actions">
          {receipt.pdf && (
            <button
              onClick={() => downloadBase64(receipt.pdf!, `${receipt.displayOrderNumber}.pdf`, 'application/pdf')}
              className="flex-1 py-3 rounded-xl font-bold border-2 border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              PDF
            </button>
          )}
          <button
            onClick={async () => {
              const mode = await reprintReceipt(queryClient, receipt.thermal);
              if (mode === 'browser') window.print();
            }}
            className="flex-1 py-3 rounded-xl font-bold border-2 border-primary-600 text-primary-600 hover:bg-primary-50 transition-colors"
          >
            Print
          </button>
          <button
            onClick={handleNewOrder}
            className="flex-[2] blue-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            {receipt.hasRemaining ? 'Bayar Sisanya' : 'Selesai'}
          </button>
        </div>
      </div>
    </div>
  );
}
