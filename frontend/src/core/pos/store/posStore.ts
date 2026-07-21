import { create } from 'zustand';
import type { ITaxConfiguration } from '../../../@shared/hooks/useTaxConfiguration';
import type { IDiscountRule, IDiscountResult } from '../../../@shared/hooks/useDiscountConfiguration';
import { calculateTax, type TaxCalcResult } from '../../../@shared/utils/taxCalculator';
import { calculateDiscount } from '../../../@shared/utils/discountCalculator';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  notes?: string;
  categoryId?: string;
  pricingProfileId?: string;
}

export type PaymentState = 'idle' | 'processing' | 'success' | 'error';

interface Receipt {
  orderNumber: string;
  paid: number;
  change: number;
  taxBreakdown: TaxCalcResult['taxBreakdown'];
  totalTax: number;
  serviceCharge: number;
  grandTotal: number;
}

interface POSState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  serviceCharge: number;
  serviceChargeName: string;
  tax: number;
  taxName: string;
  taxBreakdown: TaxCalcResult['taxBreakdown'];
  discount: number;
  discountType: 'percentage' | 'nominal';
  discountAmount: number;
  promoCode: string;
  promoApplied: IDiscountResult | null;
  discountRules: IDiscountRule[];
  total: number;

  paymentModalOpen: boolean;
  paymentState: PaymentState;
  receipt: Receipt | null;
  taxConfig: ITaxConfiguration | null;

  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setItemNotes: (productId: string, notes: string) => void;
  setDiscount: (value: number, type: 'percentage' | 'nominal') => void;
  setPromoCode: (code: string) => void;
  setDiscountRules: (rules: IDiscountRule[]) => void;
  clearCart: () => void;
  setTaxConfig: (config: ITaxConfiguration) => void;

  openPaymentModal: () => void;
  closePaymentModal: () => void;
  setPaymentState: (state: PaymentState) => void;
  setReceipt: (receipt: Omit<Receipt, 'taxBreakdown' | 'totalTax' | 'serviceCharge' | 'grandTotal'>) => void;
  clearReceipt: () => void;
}

function derive(
  items: CartItem[],
  discount: number,
  discountType: 'percentage' | 'nominal',
  taxConfig: ITaxConfiguration | null,
  discountRules?: IDiscountRule[],
  promoCode?: string,
) {
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const rawSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const manualDiscountAmt = rawSubtotal > 0
    ? (discountType === 'percentage' ? rawSubtotal * (Math.min(discount, 100) / 100) : Math.min(discount, rawSubtotal))
    : 0;

  // Apply discount engine
  let promoApplied: IDiscountResult | null = null;
  let engineDiscount = 0;
  if (discountRules && discountRules.length > 0) {
    promoApplied = calculateDiscount(
      items.map((i) => ({ productId: i.productId, categoryId: i.categoryId || '', quantity: i.quantity, unitPrice: i.price })),
      discountRules,
      promoCode,
    );
    engineDiscount = promoApplied.totalDiscount;
  }

  const totalDiscountAmount = manualDiscountAmt + engineDiscount;
  const cappedDiscount = Math.min(totalDiscountAmount, rawSubtotal);

  if (!taxConfig || !taxConfig.taxEnabled) {
    return {
      items, itemCount,
      subtotal: rawSubtotal,
      serviceCharge: 0, serviceChargeName: 'Service Charge',
      tax: 0, taxName: 'Pajak', taxBreakdown: [],
      discount, discountType,
      discountAmount: cappedDiscount,
      promoCode: promoCode || '',
      promoApplied,
      discountRules: discountRules || [],
      total: Math.max(0, rawSubtotal - cappedDiscount),
    };
  }

  // Pass total discount as nominal to tax calculator
  const result = calculateTax({
    items: items.map((i) => ({
      productId: i.productId,
      categoryId: i.categoryId || '',
      quantity: i.quantity,
      unitPrice: i.price,
    })),
    discount: cappedDiscount,
    discountType: 'nominal',
  }, taxConfig);

  const firstTax = result.taxBreakdown[0];
  const taxName = firstTax?.name ?? 'PPN';
  const scRule = taxConfig.versions
    .find((v) => v.id === taxConfig.activeVersionId)
    ?.rules.find((r) => r.taxType === 'service_charge');
  const serviceChargeName = scRule?.name ?? 'Service Charge';

  return {
    items,
    itemCount,
    subtotal: result.subtotal,
    serviceCharge: result.serviceCharge,
    serviceChargeName,
    tax: result.totalTax,
    taxName,
    taxBreakdown: result.taxBreakdown,
    discount,
    discountType,
    discountAmount: cappedDiscount,
    promoCode: promoCode || '',
    promoApplied,
    discountRules: discountRules || [],
    total: result.grandTotal,
  };
}

export const usePOSStore = create<POSState>((set) => ({
  items: [],
  itemCount: 0,
  subtotal: 0,
  serviceCharge: 0,
  serviceChargeName: 'Service Charge',
  tax: 0,
  taxName: 'PPN',
  taxBreakdown: [],
  discount: 0,
  discountType: 'nominal',
  discountAmount: 0,
  promoCode: '',
  promoApplied: null,
  discountRules: [],
  total: 0,
  paymentModalOpen: false,
  paymentState: 'idle',
  receipt: null,
  taxConfig: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        return derive(
          state.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
          state.discount,
          state.discountType,
          state.taxConfig,
          state.discountRules,
          state.promoCode,
        );
      }
      return derive(
        [...state.items, { ...item, quantity: item.quantity ?? 1 }],
        state.discount,
        state.discountType,
        state.taxConfig,
        state.discountRules,
        state.promoCode,
      );
    }),

  removeItem: (productId) =>
    set((state) => derive(
      state.items.filter((i) => i.productId !== productId),
      state.discount, state.discountType, state.taxConfig,
      state.discountRules, state.promoCode,
    )),

  updateQuantity: (productId, delta) =>
    set((state) =>
      derive(
        state.items
          .map((i) =>
            i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
          )
          .filter((i) => i.quantity > 0),
        state.discount,
        state.discountType,
        state.taxConfig,
        state.discountRules,
        state.promoCode,
      ),
    ),

  setItemNotes: (productId, notes) =>
    set((state) => ({
      ...state,
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, notes } : i,
      ),
    })),

  setDiscount: (value, type) =>
    set((state) => derive(state.items, value, type, state.taxConfig, state.discountRules, state.promoCode)),

  setPromoCode: (code) =>
    set((state) => derive(state.items, state.discount, state.discountType, state.taxConfig, state.discountRules, code)),

  setDiscountRules: (rules) =>
    set((state) => derive(state.items, state.discount, state.discountType, state.taxConfig, rules, state.promoCode)),

  setTaxConfig: (config) => {
    set((state) => derive(state.items, state.discount, state.discountType, config, state.discountRules, state.promoCode));
  },

  clearCart: () =>
    set({
      items: [], itemCount: 0, subtotal: 0,
      serviceCharge: 0, serviceChargeName: 'Service Charge',
      tax: 0, taxName: 'PPN', taxBreakdown: [],
      discount: 0, discountType: 'nominal', discountAmount: 0,
      promoCode: '', promoApplied: null, discountRules: [],
      total: 0,
      receipt: null, paymentState: 'idle',
    }),

  openPaymentModal: () => set({ paymentModalOpen: true }),
  closePaymentModal: () => set({ paymentModalOpen: false, paymentState: 'idle' }),

  setPaymentState: (paymentState) => set({ paymentState }),
  setReceipt: (receipt) => set((state) => ({
    receipt: {
      ...receipt,
      taxBreakdown: state.taxBreakdown,
      totalTax: state.tax,
      serviceCharge: state.serviceCharge,
      grandTotal: state.total,
    },
    paymentState: 'success',
    paymentModalOpen: false,
  })),
  clearReceipt: () => set({ receipt: null }),
}));
