import { useState } from 'react';
import { usePlatformCreateHub, type PlatformHub } from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  ErrorNote,
  Modal,
  apiErrorMessage,
  ghostBtnCls,
  inputCls,
  primaryBtnCls,
} from './platformUi';

function hubErrorMessage(e: unknown): string {
  const msg = apiErrorMessage(e, 'Gagal membuat hub');
  if (/already exists/i.test(msg)) return 'Nama hub sudah dipakai.';
  return msg;
}

export default function CreateHubModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (hub: PlatformHub) => void;
}) {
  const createHub = usePlatformCreateHub();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const reset = () => {
    setName('');
    setDescription('');
    setError('');
  };

  const handleClose = () => {
    if (createHub.isPending) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Nama hub wajib diisi.');
    setError('');
    try {
      const hub = await createHub.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast({ title: `Hub "${hub.name}" dibuat`, icon: 'success' });
      reset();
      onClose();
      onCreated?.(hub);
    } catch (err) {
      setError(hubErrorMessage(err));
    }
  };

  return (
    <Modal
      title="Buat Hub Baru"
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} disabled={createHub.isPending} className={ghostBtnCls}>
            Batal
          </button>
          <button type="submit" form="create-hub-form" disabled={createHub.isPending} className={primaryBtnCls}>
            {createHub.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="create-hub-form" onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Hub *</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth: BCA Hospitality"
            autoFocus
            disabled={createHub.isPending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opsional"
            disabled={createHub.isPending}
          />
        </div>
        <p className="text-xs text-gray-500">
          Hub adalah pengelompokan tenant ( grup/franchise). Tenant tetap bisa berdiri sendiri tanpa hub.
        </p>
      </form>
    </Modal>
  );
}
