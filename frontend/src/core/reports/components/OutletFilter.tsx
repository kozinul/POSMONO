import { useOutlets } from '../../../@shared/hooks/useOutlets';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { inputCls, labelCls } from './reportUi';

interface OutletFilterProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Filter outlet untuk halaman laporan. Nilai kosong = konsolidasi semua outlet
 * (perilaku default). Select disembunyikan ketika hanya ada satu outlet yang
 * dapat dipilih — memfilter data outlet tunggal tidak mengubah angka.
 */
export default function OutletFilter({ value, onChange }: OutletFilterProps) {
  const user = useAuthStore((s) => s.user);
  const { data: outlets = [] } = useOutlets();
  const scoped =
    user?.outletIds && user.outletIds.length > 0
      ? outlets.filter((o) => user.outletIds!.includes(o.id))
      : outlets;
  const options = scoped.filter((o) => o.isActive || o.id === value);
  if (options.length <= 1) return null;

  return (
    <div>
      <label className={labelCls} htmlFor="report-outlet">
        Outlet
      </label>
      <select
        id="report-outlet"
        aria-label="Filter Outlet"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">Semua Outlet</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}