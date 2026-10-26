import { useEffect, useState } from 'react';
import { formatCurrency } from '../../../@shared/utils/format';
import {
  usePlatformSetAddOns,
  usePlatformTenantEntitlement,
} from '../../../@shared/hooks/useSubscriptionAddOns';

interface Props {
  tenantId: string;
}

/**
 * Add-ons are tenant-level switches on top of the assigned plan. KDS is the
 * first module add-on, so the section is intentionally generic: plan add-ons
 * are rendered from the entitlement payload, never from a hardcoded list.
 */
export default function TenantAddOnsSection({ tenantId }: Props) {
  const { data: entitlement, isLoading } = usePlatformTenantEntitlement(tenantId);
  const setAddOns = usePlatformSetAddOns(tenantId);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setSelected(entitlement?.enabledAddOns ?? []);
  }, [entitlement?.enabledAddOns]);

  const addOns = entitlement?.addOns ?? [];
  if (isLoading) return <p className="text-sm text-gray-500">Memuat add-on…</p>;
  if (!entitlement?.subscription) {
    return <p className="text-sm text-gray-500">Tenant belum memiliki langganan aktif.</p>;
  }

  const toggle = (id: string) => {
    setMessage('');
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const save = async () => {
    setMessage('');
    try {
      await setAddOns.mutateAsync(selected);
      setMessage('Add-on berhasil disimpan.');
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string; error?: { message?: string } } } })
        .response?.data;
      setMessage(message?.error?.message || message?.message || 'Gagal menyimpan add-on.');
    }
  };

  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Add-on Modul</h3>
      <p className="text-xs text-gray-500 mb-3">
        Add-on aktif menambah modul tanpa mengganti plan. KDS membutuhkan add-on ini bila plan tidak memuatnya.
      </p>

      {addOns.length === 0 ? (
        <p className="text-sm text-gray-500">Plan ini tidak menyediakan add-on.</p>
      ) : (
        <div className="space-y-2">
          {addOns.map((addOn) => (
            <label
              key={addOn.id}
              className="flex items-start gap-3 border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.includes(addOn.id)}
                onChange={() => toggle(addOn.id)}
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-gray-800">{addOn.name}</span>
                <span className="block text-xs text-gray-500">{addOn.description}</span>
              </span>
              <span className="text-xs font-semibold text-gray-700">
                {addOn.price > 0 ? formatCurrency(addOn.price) : 'Gratis'}
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={save}
            disabled={setAddOns.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {setAddOns.isPending ? 'Menyimpan…' : 'Simpan Add-on'}
          </button>
          {message && (
            <p className={`text-xs ${message.includes('berhasil') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-2">Modul efektif saat ini:</p>
        <div className="flex flex-wrap gap-1.5">
          {(entitlement.modules ?? []).map((moduleName) => (
            <span
              key={moduleName}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                moduleName === 'kds' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {moduleName}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
