import { ITenant } from '../../../tenant/domain/Tenant';
import { ITaxDetail, IOrder, IPaymentBreakdownEntry } from '../../../ordering/domain/Order';
import { IPayment } from '../../../payment/domain/Payment';
import { OutletRepository } from '../../../outlet/domain/OutletRepository';
import { ReceiptViewModel, VMItem, VMPayment, methodLabel } from './ReceiptViewModel';
import { buildModifierLines } from './modifierLines';

const pad = (n: number) => String(n).padStart(2, '0');

function formatDateParts(date: Date, timezone: string, locale: string): { date: string; time: string } {
  try {
    const parts: Record<string, string> = {};
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    const hour = parts.hour === '24' ? '00' : parts.hour ?? '00';
    return {
      date: `${parts.day}/${parts.month}/${parts.year}`,
      time: `${hour}:${parts.minute ?? '00'}`,
    };
  } catch {
    return {
      date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
  }
}

function taxLabel(tax: ITaxDetail, fallbackName: string): string {
  const baseName = tax.name && tax.name !== 'tax' ? tax.name : fallbackName;
  const withRate = baseName + (tax.rate > 0 ? ` ${tax.rate}%` : '');
  return tax.fraction ? `${withRate} (DPP ${tax.fraction})` : withRate;
}

function dppLabel(taxes: ITaxDetail[], fallbackName: string): string {
  const fraction = taxes.find((t) => t.fraction)?.fraction;
  const baseName = taxes.find((t) => t.name && t.name !== 'tax')?.name ?? fallbackName;
  return fraction ? `DPP ${baseName} (${fraction})` : 'DPP';
}

function buildItems(order: IOrder): VMItem[] {
  return order.items.map((item) => ({
    name: item.productName ?? '',
    qty: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    isFreeItem: item.isFreeItem || false,
    modifiers: (item.modifiers ?? []).map((m) => ({ name: m.optionName, qty: 1, price: m.priceAdjustment })),
    modifierLines: buildModifierLines(item.modifiers),
  }));
}

function buildPayments(payments: IPaymentBreakdownEntry[]): VMPayment[] {
  if (!payments || payments.length === 0) {
    return [];
  }
  return payments.map((p) => {
    const m = p.method || 'cash';
    const entry: VMPayment = {
      method: m,
      methodLabel: methodLabel(m),
      amount: p.amount,
    };
    if (m !== 'cash' && p.code) {
      entry.referenceLine = `Ref: ${p.code}`;
    }
    return entry;
  });
}

export class ReceiptAssembler {
  constructor(private readonly outletRepository: OutletRepository | null) {}

  async build(input: {
    order: IOrder;
    tenant: ITenant;
    payments?: IPaymentBreakdownEntry[];
    payment?: IPayment | null;
    splitIndex?: number;
    totalSplits?: number;
    splitBaseOrderNumber?: string;
  }): Promise<ReceiptViewModel> {
    const { order, tenant, splitIndex, splitBaseOrderNumber } = input;

    let outletName = '';
    try {
      const outlet = order.outletId
        ? await this.outletRepository?.findById(order.outletId)
        : await this.outletRepository?.findDefault(tenant.id);
      outletName = outlet?.serialize().name ?? '';
    } catch {
      outletName = '';
    }

    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const timezone = tenant.config?.timezone || 'Asia/Jakarta';
    const locale = tenant.config?.locale || 'id-ID';
    const { date, time } = formatDateParts(createdAt, timezone, locale);

    const orderNumber = splitBaseOrderNumber || order.orderNumber;
    const splitSuffix = splitIndex != null && splitIndex > 0 ? `/${splitIndex}` : '';

    const payments = buildPayments(
      input.payments && input.payments.length > 0
        ? input.payments
        : order.paymentBreakdown && order.paymentBreakdown.length > 0
          ? order.paymentBreakdown
          : input.payment
            ? [{ method: input.payment.method, code: input.payment.referenceNumber, amount: input.payment.amount, change: 0 }]
            : [],
    );
    const totalTendered = payments.reduce((sum, p) => sum + p.amount, 0);
    const grandTotal = order.roundedPayable || order.total;
    const change = totalTendered > 0 ? Math.max(0, totalTendered - grandTotal) : 0;

    const taxes = order.taxDetails ?? [];
    const fallbackName = tenant.config?.taxName || 'PPN';

    return {
      store: {
        name: tenant.name ?? '',
        outlet: outletName,
        address: tenant.address ?? '',
        phone: tenant.phone ?? '',
        logo: tenant.config?.receiptLogo ?? '',
        taxNumber: '',
      },
      order: {
        documentNumber: `${orderNumber}${splitSuffix}`,
        referenceNumber: order.invoiceNumber ?? undefined,
        type: (order.transactionType ?? 'dine_in') as string,
        table: order.tableNumber ?? undefined,
        cashier: order.cashierName || order.cashierId,
        date,
        time,
        notes: order.notes || undefined,
      },
      items: buildItems(order),
      promotions: order.promotions.map((p) => ({
        name: p.name,
        code: p.code,
        discount: p.totalDiscount,
      })),
      summary: {
        subtotal: order.subtotal - order.discount,
        orderDiscount: order.discount,
        serviceCharge: order.serviceCharge,
        serviceChargeRate: order.serviceChargeRate,
        dpp: order.dppTotal,
        dppLabel: dppLabel(taxes, fallbackName),
        taxes: (() => {
          const taxMap = new Map<string, { name: string; rate: number; amount: number; baseAmount: number; fraction?: string }>();
          for (const t of taxes) {
            const key = `${t.name || 'tax'}_${t.rate}`;
            const existing = taxMap.get(key);
            if (existing) {
              existing.amount += t.amount;
              existing.baseAmount += t.baseAmount;
            } else {
              taxMap.set(key, {
                name: t.name && t.name !== 'tax' ? t.name : fallbackName,
                rate: t.rate,
                amount: t.amount,
                baseAmount: t.baseAmount,
                fraction: t.fraction,
              });
            }
          }
          return Array.from(taxMap.values()).map((t) => ({
            name: t.name,
            label: taxLabel(t as ITaxDetail, fallbackName),
            rate: t.rate,
            amount: Math.round(t.amount),
            baseAmount: Math.round(t.baseAmount),
          }));
        })(),
        tax: order.tax,
        rounding: order.roundingAdjustment,
        grandTotal,
        change,
      },
      payments,
      footer:
        tenant.config?.receiptFooter?.trim() ||
        `Terima kasih telah berbelanja di ${outletName || tenant.name || ''}`.trim(),
    };
  }
}