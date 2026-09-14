import { useState } from 'react';
import {
  usePlatformPlans,
  usePlatformCreatePlan,
  usePlatformUpdatePlan,
  usePlatformDeletePlan,
  PLAN_MODULE_LABELS,
  type PlatformPlan,
  type PlatformPlanLimits,
  type PlanInput,
} from '../../../@shared/hooks/usePlatform';
import { formatCurrency } from '../../../@shared/utils/format';

const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';
const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6';

const ALL_MODULE_KEYS = Object.keys(PLAN_MODULE_LABELS);

const DEFAULT_LIMITS: PlatformPlanLimits = {
  maxUsers: 5,
  maxProducts: 100,
  maxCategories: 20,
  maxOutlets: 1,
  maxOrdersPerMonth: 500,
  maxInventoryItems: 500,
  maxWarehouses: 1,
};

function Loading() {
  return <p className="text-sm text-gray-500 py-6 text-center">Memuat...</p>;
}

function PlanDetailModal({ plan, onClose }: { plan: PlatformPlan | null; onClose: () => void }) {
  const createPlan = usePlatformCreatePlan();
  const updatePlan = usePlatformUpdatePlan();
  const deletePlan = usePlatformDeletePlan();
  const isEdit = !!plan;

  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [basePrice, setBasePrice] = useState(String(plan?.basePrice ?? 0));
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual' | 'custom'>(plan?.billingCycle ?? 'monthly');
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [isPublic, setIsPublic] = useState(plan?.isPublic ?? true);
  const [isDefault, setIsDefault] = useState(plan?.isDefault ?? false);
  const [sortOrder, setSortOrder] = useState(String(plan?.sortOrder ?? 0));
  const [modules, setModules] = useState<string[]>(plan?.modules ?? []);
  const [limits, setLimits] = useState<PlatformPlanLimits>(plan?.limits ?? DEFAULT_LIMITS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleModule = (mod: string) => {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const handleSave = async () => {
    if (!name.trim()) return setError('Nama plan wajib diisi');
    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price < 0) return setError('Harga harus ≥ 0');
    setError('');
    setSaving(true);

    const input: PlanInput = {
      name: name.trim(),
      description: description.trim(),
      basePrice: price,
      billingCycle,
      isActive,
      isPublic,
      isDefault,
      sortOrder: parseInt(sortOrder, 10) || 0,
      modules,
      limits,
    };

    try {
      if (isEdit) {
        await updatePlan.mutateAsync({ planId: plan!.id, ...input });
      } else {
        await createPlan.mutateAsync(input);
      }
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Gagal menyimpan plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await deletePlan.mutateAsync(plan.id);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Gagal menghapus plan');
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = (key: keyof PlatformPlanLimits, value: string) => {
    const num = parseInt(value, 10);
    setLimits((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? `Edit: ${plan!.name}` : 'Buat Plan Baru'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Plan *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro, Starter, ..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat plan" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp) *</label>
              <input className={inputCls} type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
              <select className={inputCls} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as any)}>
                <option value="monthly">Bulanan</option>
                <option value="annual">Tahunan</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
              <input className={inputCls} type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
            <div className="flex gap-6 items-end pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                Aktif
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded" />
                Public
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
                Default
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Modules (Fitur yang Diaktifkan)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_MODULE_KEYS.map((mod) => (
                <label key={mod} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={modules.includes(mod)}
                    onChange={() => toggleModule(mod)}
                    className="rounded"
                  />
                  <span>{PLAN_MODULE_LABELS[mod] ?? mod}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Limits (Batas Penggunaan)</h4>
            <p className="text-xs text-gray-500 mb-3">Gunakan -1 untuk unlimited.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.keys(DEFAULT_LIMITS) as (keyof PlatformPlanLimits)[]).map((key) => {
                const label = key
                  .replace(/^max/, '')
                  .replace(/([A-Z])/g, ' $1')
                  .trim();
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{label}</label>
                    <input
                      className={inputCls}
                      type="number"
                      value={limits[key]}
                      onChange={(e) => updateLimit(key, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-between sticky bottom-0 bg-white">
          <div>
            {isEdit && !plan!.isDefault && (
              <>
                {showDeleteConfirm ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-red-600 font-medium">Yakin hapus?</span>
                    <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                      {saving ? '...' : 'Ya, Hapus'}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="text-sm text-gray-500 hover:text-gray-700">Batal</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded border border-red-200"
                  >
                    Hapus Plan
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlansSection() {
  const { data: plans = [], isLoading } = usePlatformPlans();
  const [editPlan, setEditPlan] = useState<PlatformPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Plans & Harga</h2>
        <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Buat Plan
        </button>
      </div>

      {(createOpen || editPlan) && (
        <PlanDetailModal
          plan={editPlan}
          onClose={() => { setCreateOpen(false); setEditPlan(null); }}
        />
      )}

      {isLoading ? (
        <Loading />
      ) : plans.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada plan. Klik "Buat Plan" untuk menambah.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setEditPlan(plan)}
              className={`border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all relative ${
                plan.isDefault ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {plan.isDefault && (
                <span className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Default
                </span>
              )}
              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              {plan.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plan.description}</p>}

              <div className="mt-3">
                <span className="text-2xl font-extrabold text-gray-900">{plan.basePrice === 0 ? 'Gratis' : formatCurrency(plan.basePrice)}</span>
                {plan.basePrice > 0 && (
                  <span className="text-xs text-gray-500 ml-1">/ {plan.billingCycle === 'annual' ? 'tahun' : 'bulan'}</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {plan.modules.slice(0, 5).map((mod) => (
                  <span key={mod} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                    {PLAN_MODULE_LABELS[mod] ?? mod}
                  </span>
                ))}
                {plan.modules.length > 5 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">+{plan.modules.length - 5} lagi</span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>{plan.limits.maxUsers === -1 ? '∞' : plan.limits.maxUsers} user</span>
                <span>{plan.limits.maxProducts === -1 ? '∞' : plan.limits.maxProducts} produk</span>
                <span>{plan.limits.maxOutlets === -1 ? '∞' : plan.limits.maxOutlets} outlet</span>
                <span>{plan.addOns.length} add-on</span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {plan.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
                {plan.isPublic && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Public</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
