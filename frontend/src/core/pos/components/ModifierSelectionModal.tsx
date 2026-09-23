import { useState } from 'react';
import { ModifierGroup, ModifierOption } from '../../modifiers/hooks/useModifiers';
import { formatIDR } from '../utils/money';

interface ModifierSelectionModalProps {
  productName: string;
  basePrice: number;
  modifierGroups: ModifierGroup[];
  onConfirm: (selectedModifiers: Array<{ groupId: string; groupName: string; optionId: string; optionName: string; priceAdjustment: number }>, unitPrice: number) => void;
  onClose: () => void;
}

export function ModifierSelectionModal({ productName, basePrice, modifierGroups, onConfirm, onClose }: ModifierSelectionModalProps) {
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {};
    for (const g of modifierGroups) {
      initial[g.id] = {};
      const activeOpts = g.options.filter((o) => o.isActive);
      if (g.displayType === 'radio' && activeOpts.length > 0) {
        initial[g.id][activeOpts[0].id] = 1;
      }
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const handleSelectOption = (group: ModifierGroup, option: ModifierOption) => {
    setSelections((prev) => {
      const groupSel = { ...(prev[group.id] || {}) };
      if (group.displayType === 'radio') {
        return { ...prev, [group.id]: { [option.id]: 1 } };
      } else if (group.displayType === 'checkbox') {
        const currentCount = groupSel[option.id] || 0;
        if (currentCount > 0) {
          delete groupSel[option.id];
        } else {
          const totalSelected = Object.values(groupSel).reduce((a, b) => a + b, 0);
          if (group.maxSelections > 0 && totalSelected >= group.maxSelections) {
            return prev;
          }
          groupSel[option.id] = 1;
        }
        return { ...prev, [group.id]: groupSel };
      }
      return prev;
    });
  };

  const handleStepperChange = (group: ModifierGroup, option: ModifierOption, delta: number) => {
    setSelections((prev) => {
      const groupSel = { ...(prev[group.id] || {}) };
      const current = groupSel[option.id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        delete groupSel[option.id];
      } else {
        const totalSelected = Object.entries(groupSel).reduce((acc, [id, qty]) => acc + (id === option.id ? 0 : qty), 0) + next;
        if (group.maxSelections > 0 && totalSelected > group.maxSelections) {
          return prev;
        }
        groupSel[option.id] = next;
      }
      return { ...prev, [group.id]: groupSel };
    });
  };

  let modifierTotalAdjustment = 0;
  const flatModifiers: Array<{ groupId: string; groupName: string; optionId: string; optionName: string; priceAdjustment: number }> = [];

  for (const g of modifierGroups) {
    const groupSel = selections[g.id] || {};
    for (const opt of g.options) {
      const qty = groupSel[opt.id] || 0;
      if (qty > 0) {
        for (let i = 0; i < qty; i++) {
          modifierTotalAdjustment += opt.priceAdjustment;
          flatModifiers.push({
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            priceAdjustment: opt.priceAdjustment,
          });
        }
      }
    }
  }

  const finalUnitPrice = basePrice + modifierTotalAdjustment;

  const handleConfirm = () => {
    for (const g of modifierGroups) {
      const groupSel = selections[g.id] || {};
      const totalSelected = Object.values(groupSel).reduce((a, b) => a + b, 0);
      if (g.required && totalSelected === 0) {
        setError(`Pilihan "${g.name}" wajib diisi.`);
        return;
      }
      if (g.minSelections > 0 && totalSelected < g.minSelections) {
        setError(`Pilihan "${g.name}" minimal ${g.minSelections} pilihan.`);
        return;
      }
    }
    setError(null);
    onConfirm(flatModifiers, finalUnitPrice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{productName}</h2>
            <p className="text-xs text-gray-500">Pilih opsi modifier / tambahan</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">×</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl">{error}</div>
          )}
          {modifierGroups.map((g) => {
            const groupSel = selections[g.id] || {};
            return (
              <div key={g.id} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800 text-sm">
                    {g.name} {g.required && <span className="text-red-500">*</span>}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {g.displayType === 'radio' ? 'Pilih 1' : g.minSelections > 0 ? `Min ${g.minSelections}` : 'Opsional'}
                  </span>
                </div>
                <div className="space-y-2">
                  {g.options.filter((o) => o.isActive).map((opt) => {
                    const isSelected = (groupSel[opt.id] || 0) > 0;
                    const count = groupSel[opt.id] || 0;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          if (g.displayType !== 'stepper') handleSelectOption(g, opt);
                        }}
                        className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                          g.displayType !== 'stepper' ? 'cursor-pointer' : ''
                        } ${isSelected ? 'border-primary-500 bg-primary-50/30' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          {g.displayType === 'checkbox' && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOption(g, opt)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          )}
                          {g.displayType === 'radio' && (
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => handleSelectOption(g, opt)}
                              className="border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          )}
                          <span className="text-sm font-medium text-gray-700">{opt.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {opt.priceAdjustment > 0 && (
                            <span className="text-xs font-semibold text-gray-500">+Rp {formatIDR(opt.priceAdjustment)}</span>
                          )}
                          {g.displayType === 'stepper' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStepperChange(g, opt, -1); }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{count}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStepperChange(g, opt, 1); }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <p className="text-xs text-gray-500">Total Harga Satuan</p>
            <p className="text-lg font-bold text-gray-900">Rp {formatIDR(finalUnitPrice)}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-600 hover:bg-gray-100 transition-colors text-sm"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-primary-600 font-bold text-white hover:opacity-90 transition-opacity text-sm shadow-md"
            >
              Tambah ke Keranjang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
