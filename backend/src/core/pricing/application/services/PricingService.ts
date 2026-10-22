import { DiscountServiceAdapter } from '../../../discount/application/services/DiscountServiceAdapter';
import { allocateFreeUnits } from '../../../discount/domain/freeItemAllocation';
import { PricingEngine, PricingInput, PricingResult as TaxPricingResult } from '../../../tax/domain/PricingEngine';
import { roundToDenomination, TotalRoundingMode } from '../../../tax/domain/RoundingEngine';
import { TaxConfiguration } from '../../../tax/domain/TaxConfiguration';
import { ITaxConfigurationRepository } from '../../../tax/infrastructure/persistence/ITaxConfigurationRepository';
import { logger } from '../../../../@shared/infrastructure/logger/Logger';

interface PricingLineItem {
  productId: string;
  productName: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  discount: number;
  lineTotal: number;
  isFreeItem: boolean;
  freeByRuleId?: string;
}

export interface PricingResult {
  originalSubtotal: number;
  promotionDiscount: number;
  netSubtotal: number;
  serviceCharge: number;
  serviceChargeName: string;
  taxBase: number;
  tax: number;
  taxName: string;
  taxRate: number;
  rounding: number;
  grandTotal: number;
  roundedPayable: number;
  lineItems: PricingLineItem[];
  adjustments: TaxPricingResult['adjustments'];
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    discountAmount: number;
    description: string;
  }>;
}

export class PricingService {
  private readonly taxEngine = new PricingEngine();

  constructor(
    private readonly discountService: DiscountServiceAdapter,
    private readonly taxConfigRepo: ITaxConfigurationRepository,
    private readonly tenantRepository?: { findById(id: string): Promise<{ serialize(): { config: any } } | null> },
  ) {}

  async calculate(input: {
    tenantId: string;
    items: Array<{
      productId: string;
      productName: string;
      categoryId: string;
      quantity: number;
      unitPrice: number;
      pricingMode?: 'inclusive' | 'exclusive';
    }>;
    promoCode?: string;
    customerGroupId?: string;
    manualDiscount?: number;
    manualDiscountType?: 'percentage' | 'nominal';
  }): Promise<PricingResult> {
    const originalSubtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

    const discountResult = await this.discountService.apply({
      tenantId: input.tenantId,
      items: input.items.map((i) => ({
        productId: i.productId,
        categoryId: i.categoryId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      promoCode: input.promoCode,
      customerGroupId: input.customerGroupId,
    });

    const freeQtyByProduct = new Map<string, number>();
    for (const fi of discountResult.freeItems) {
      freeQtyByProduct.set(fi.productId, (freeQtyByProduct.get(fi.productId) ?? 0) + fi.quantity);
    }

    // The free units come from the cheapest line of their product — the same
    // rule the discount engine priced them with, so the receipt lines add up
    // to the quoted amount even when a product sits in the cart twice (same
    // product, different modifiers → different unit prices).
    const freeQtyByLine = new Map<number, number>();
    const allocations = allocateFreeUnits(input.items, freeQtyByProduct);
    for (const allocation of allocations) {
      freeQtyByLine.set(allocation.lineIndex, (freeQtyByLine.get(allocation.lineIndex) ?? 0) + allocation.quantity);
    }

    const lineItems: PricingLineItem[] = [];
    input.items.forEach((item, index) => {
      const freeQty = freeQtyByLine.get(index) ?? 0;
      if (freeQty > 0) {
        lineItems.push({
          productId: item.productId,
          productName: item.productName,
          categoryId: item.categoryId,
          quantity: freeQty,
          unitPrice: 0,
          originalUnitPrice: item.unitPrice,
          discount: item.unitPrice * freeQty,
          lineTotal: 0,
          isFreeItem: true,
          freeByRuleId: '',
        });
        const paidQty = item.quantity - freeQty;
        if (paidQty > 0) {
          lineItems.push({
            productId: item.productId,
            productName: item.productName,
            categoryId: item.categoryId,
            quantity: paidQty,
            unitPrice: item.unitPrice,
            originalUnitPrice: item.unitPrice,
            discount: 0,
            lineTotal: item.unitPrice * paidQty,
            isFreeItem: false,
          });
        }
      } else {
        lineItems.push({
          productId: item.productId,
          productName: item.productName,
          categoryId: item.categoryId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          originalUnitPrice: item.unitPrice,
          discount: 0,
          lineTotal: item.unitPrice * item.quantity,
          isFreeItem: false,
        });
      }
    });

    for (const gli of discountResult.generatedLineItems) {
      if (!lineItems.some((li) => li.productId === gli.productId)) {
        lineItems.push({
          productId: gli.productId,
          productName: gli.productName,
          categoryId: gli.categoryId,
          quantity: gli.quantity,
          unitPrice: 0,
          originalUnitPrice: gli.unitPrice,
          discount: gli.unitPrice * gli.quantity,
          lineTotal: 0,
          isFreeItem: true,
        });
      }
    }

    // Units the promotion gives away that are not in the cart are handed over
    // as a gift, worth the product's cheapest price — the same figure the
    // discount engine counted, so the two cannot drift apart.
    for (const [productId, requested] of freeQtyByProduct) {
      const allocated = allocations
        .filter((a) => a.productId === productId)
        .reduce((sum, a) => sum + a.quantity, 0);
      const surplus = requested - allocated;
      if (surplus <= 0) continue;
      const source = input.items.find((i) => i.productId === productId);
      const referencePrice = source
        ? Math.min(...input.items.filter((i) => i.productId === productId).map((i) => i.unitPrice))
        : 0;
      lineItems.push({
        productId,
        productName: source?.productName ?? '',
        categoryId: source?.categoryId ?? '',
        quantity: surplus,
        unitPrice: 0,
        originalUnitPrice: referencePrice,
        discount: referencePrice * surplus,
        lineTotal: 0,
        isFreeItem: true,
        freeByRuleId: '',
      });
    }

    // Value taken off by free-item effects (price × quantity). The engine owns
    // this number — the payment path uses the same source, so the quoted
    // amount and the amount taken at the till cannot drift apart. Without it
    // "beli 3 bayar 2" would charge for the free unit(s).
    const freeItemValue = discountResult.freeItemValue;

    let manualDiscountAmount = 0;
    if (input.manualDiscount && input.manualDiscount > 0) {
      if (input.manualDiscountType === 'percentage') {
        manualDiscountAmount = originalSubtotal * (Math.min(input.manualDiscount, 100) / 100);
      } else {
        manualDiscountAmount = Math.min(input.manualDiscount, originalSubtotal);
      }
    }

    const totalDiscount = discountResult.totalDiscount + freeItemValue + manualDiscountAmount;
    const netSubtotal = originalSubtotal - totalDiscount;

    const itemDiscountMap = new Map(discountResult.itemDiscounts.map((d) => [d.productId, d.discountAmount]));
    const paidItems = lineItems.filter((i) => !i.isFreeItem);
    const paidSubtotal = paidItems.reduce((s, i) => s + i.lineTotal, 0);
    for (const li of paidItems) {
      const origLineTotal = li.lineTotal;
      const autoDisc = itemDiscountMap.get(li.productId) || 0;
      const manualDisc = manualDiscountAmount > 0 && paidSubtotal > 0
        ? Math.round((origLineTotal / paidSubtotal) * manualDiscountAmount)
        : 0;
      const itemDisc = autoDisc + manualDisc;
      const newLineTotal = origLineTotal - itemDisc;
      li.discount = 0;
      li.unitPrice = li.quantity > 0 ? newLineTotal / li.quantity : 0;
      li.lineTotal = newLineTotal;
    }

    const taxConfig = await this.taxConfigRepo.findByTenantId(input.tenantId);
    let serviceCharge = 0;
    let serviceChargeName = 'Service Charge';
    let tax = 0;
    let taxName = 'Pajak';
    let taxRate = 0;
    let taxBase = netSubtotal;
    let grandTotal = netSubtotal;
    let adjustments: TaxPricingResult['adjustments'] = [];

    if (taxConfig && taxConfig.isTaxEnabled()) {
      const taxInput: PricingInput = {
        tenantId: input.tenantId,
        items: input.items.map((i) => ({
          id: i.productId,
          productId: i.productId,
          productName: i.productName,
          categoryId: i.categoryId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          pricingMode: i.pricingMode,
        })),
        discount: totalDiscount,
        discountType: 'nominal' as const,
        customerTags: input.customerGroupId ? [input.customerGroupId] : undefined,
      };

      const taxResult = this.taxEngine.calculate(taxInput, taxConfig);

      serviceCharge = taxResult.charges.reduce((sum, c) => sum + c.amount, 0);
      const scCharge = taxConfig.getActiveCharges().find((c: any) => c.isActive);
      serviceChargeName = scCharge?.getName() ?? 'Service Charge';

      tax = taxResult.taxAmount;
      const taxRule = taxResult.taxes[0];
      taxName = taxRule?.name ?? 'Pajak';
      taxRate = taxRule?.rate ?? 0;

      taxBase = taxResult.taxBase;
      grandTotal = taxResult.grandTotal;
      adjustments = taxResult.adjustments;
    } else {
      grandTotal = netSubtotal;
    }

    grandTotal = Math.round(grandTotal);

    let rounding = 0;
    if (this.tenantRepository) {
      const tenant = await this.tenantRepository.findById(input.tenantId);
      const cfg = tenant?.serialize().config;
      if (cfg?.roundingEnabled && cfg.roundingDenomination > 0) {
        const rounded = roundToDenomination(
          grandTotal,
          (cfg.roundingMode || 'nearest') as TotalRoundingMode,
          cfg.roundingDenomination,
        );
        rounding = rounded - grandTotal;
      }
    }
    const roundedPayable = grandTotal + rounding;

    logger.info({ originalSubtotal, promotionDiscount: discountResult.totalDiscount + freeItemValue, tax, taxRate, serviceCharge, grandTotal, rounding }, 'Pricing calculated');

    return {
      originalSubtotal,
      promotionDiscount: discountResult.totalDiscount + freeItemValue,
      netSubtotal,
      serviceCharge,
      serviceChargeName,
      taxBase,
      tax,
      taxName,
      taxRate,
      rounding,
      grandTotal,
      roundedPayable,
      lineItems,
      adjustments,
      appliedRules: discountResult.appliedRules,
    };
  }
}
