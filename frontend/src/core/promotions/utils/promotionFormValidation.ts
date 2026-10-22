import { RULE_REGISTRY } from '../components/rules/registry';
import { EFFECT_REGISTRY } from '../components/effects/registry';
import type { FormState } from './promotionFormState';

/**
 * Validation of the promotion form.
 *
 * The quantity rules are not cosmetic: "Beli 3 Bayar 0" (an empty "Bayar"
 * field arrives as 0) means "pay nothing" and hands over the whole cart for
 * free. The backend refuses that configuration as well, but the form has to
 * stop it before it is saved and has to say *why* in the editor.
 */
export function validatePromotionForm(state: FormState): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!state.name.trim()) errs.name = 'Nama wajib diisi';

  const enabledRules = state.rules.filter((r) => r.enabled);
  const enabledEffects = state.effects.filter((e) => e.enabled);

  enabledRules.forEach((r, i) => {
    if (!RULE_REGISTRY[r.type]) errs[`rule_${i}`] = `Rule type "${r.type}" tidak dikenal`;
  });

  enabledEffects.forEach((e, i) => {
    if (!EFFECT_REGISTRY[e.type]) errs[`effect_${i}`] = `Effect type "${e.type}" tidak dikenal`;
    if (e.type === 'percentage' && !(e.params.value as number > 0)) {
      errs[`effect_${i}_value`] = 'Persentase harus > 0';
    }
    if (e.type === 'buy_x_pay_y') {
      const minQty = e.params.buyQuantity as number;
      const payQty = e.params.payQuantity as number;
      if (!minQty || minQty < 1) errs[`effect_${i}_minQty`] = 'Min. Beli harus diisi';
      if (payQty === undefined || payQty < 1) {
        errs[`effect_${i}_payQty`] = 'Jumlah yang dibayar minimal 1 — 0 berarti seluruh pesanan gratis';
      } else if (minQty && payQty >= minQty) {
        errs[`effect_${i}_invalid`] = 'Min. Beli harus > Bayar';
      }
    }
    if (e.type === 'buy_x_get_y') {
      const buyQty = e.params.buyQuantity as number;
      const getQty = e.params.getQuantity as number;
      if (!buyQty || buyQty < 1) errs[`effect_${i}_buyQty`] = 'Beli Qty harus diisi';
      if (!getQty || getQty < 1) errs[`effect_${i}_getQty`] = 'Dapat Qty harus diisi';
    }
  });

  if (enabledEffects.length === 0) errs.effects = 'Minimal 1 effect aktif';

  return errs;
}
