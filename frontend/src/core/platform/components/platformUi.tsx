import type { ReactNode } from 'react';

export const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';
export const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6';

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold text-gray-900">{children}</h2>;
}

export function Loading({ label = 'Memuat...' }: { label?: string }) {
  return <p className="text-sm text-gray-500 py-6 text-center">{label}</p>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-500 py-6 text-center">{children}</p>;
}

export function Badge({ tone, children }: { tone: 'green' | 'gray' | 'red' | 'amber' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-500',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  } as const;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${tones[tone]}`}>{children}</span>
  );
}

export function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-2xl shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Tutup" className="text-gray-400 hover:text-gray-600 text-lg font-bold">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export const primaryBtnCls =
  'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50';
export const ghostBtnCls =
  'px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50';
export const dangerBtnCls =
  'px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 disabled:opacity-50';
export const subtleBtnCls =
  'px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 disabled:opacity-50';
export const smallPillBtnCls =
  'px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 disabled:opacity-50';

export function StatCard({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{loading ? '-' : value}</p>
    </div>
  );
}
