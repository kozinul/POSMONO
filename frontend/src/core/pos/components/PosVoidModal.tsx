import { useState } from 'react';

interface PosVoidModalProps {
  title: string;
  description: string;
  requiresPin: boolean;
  isPending: boolean;
  error?: string | null;
  onSubmit: (reason: string, managerPin?: string) => void;
  onClose: () => void;
}

export function PosVoidModal({ title, description, requiresPin, isPending, error, onSubmit, onClose }: PosVoidModalProps) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [managerPin, setManagerPin] = useState('');

  const handleNext = () => {
    if (reason.trim().length === 0) return;
    if (requiresPin) {
      setStep(2);
      return;
    }
    onSubmit(reason.trim());
  };

  const handleConfirm = () => {
    if (requiresPin && managerPin.trim().length === 0) return;
    onSubmit(reason.trim(), requiresPin ? managerPin.trim() : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || isPending) return;
    if (step === 1) handleNext();
    else handleConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} disabled={isPending} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 1 ? 'text-red-600' : 'text-gray-400'}`}>
              <span className={`h-5 w-5 flex items-center justify-center rounded-full border-2 ${step === 1 ? 'border-red-600' : 'border-gray-300'}`}>1</span>
              Alasan
            </div>
            <div className="flex-1 h-px bg-gray-200" />
            <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 2 ? 'text-red-600' : 'text-gray-400'}`}>
              <span className={`h-5 w-5 flex items-center justify-center rounded-full border-2 ${step === 2 ? 'border-red-600' : 'border-gray-300'}`}>2</span>
              Persetujuan
            </div>
          </div>

          {step === 1 ? (
            <>
              <p className="text-sm text-gray-600">{description}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alasan Void <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Masukkan alasan void..."
                  rows={3}
                  autoFocus
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium">Persetujuan Manajer Diperlukan</p>
                <p className="text-sm text-yellow-600 mt-1">
                  Masukkan PIN manajer yang hadir untuk menyetujui void.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN Manajer <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN 4-6 digit"
                  autoFocus
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-center tracking-widest"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => (step === 2 ? setStep(1) : onClose())}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {step === 2 ? 'Kembali' : 'Batal'}
            </button>
            {step === 1 ? (
              <button
                onClick={handleNext}
                disabled={reason.trim().length === 0}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Lanjut
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={isPending || (requiresPin && managerPin.trim().length === 0)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Memproses...' : 'Konfirmasi Void'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
