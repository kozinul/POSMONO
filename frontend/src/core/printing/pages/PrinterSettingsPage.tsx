import { useState } from 'react';
import Swal from 'sweetalert2';
import type { Printer, PrinterConnectionType, PrinterPaperSize, PrinterPurpose } from '@posmono/shared';
import { usePrinters, useCreatePrinter, useUpdatePrinter, useDeletePrinter, useTestPrinter } from '../hooks/usePrinters';
import { printViaClient } from '../utils/PrintClient';

interface FormState {
  name: string;
  connectionType: PrinterConnectionType;
  ip: string;
  port: number;
  paperSize: PrinterPaperSize;
  purpose: PrinterPurpose;
  copies: number;
  isDefault: boolean;
  enabled: boolean;
  bluetoothName: string;
  usbVendorId: string;
  usbProductId: string;
}

const emptyForm: FormState = {
  name: '',
  connectionType: 'network',
  ip: '',
  port: 9100,
  paperSize: 'thermal80',
  purpose: 'receipt',
  copies: 1,
  isDefault: false,
  enabled: true,
  bluetoothName: '',
  usbVendorId: '',
  usbProductId: '',
};

const connectionLabels: Record<PrinterConnectionType, string> = {
  network: 'Jaringan (IP)',
  usb: 'USB',
  bluetooth: 'Bluetooth',
};

const paperLabels: Record<PrinterPaperSize, string> = {
  thermal58: 'Thermal 58mm',
  thermal80: 'Thermal 80mm',
  'a4-portrait': 'A4 Portrait',
};

function purposeLabel(purpose: PrinterPurpose): string {
  return purpose === 'receipt' ? 'Struk' : 'KOT (Dapur)';
}

export default function PrinterSettingsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: printers = [], isLoading } = usePrinters();
  const createMutation = useCreatePrinter();
  const updateMutation = useUpdatePrinter();
  const deleteMutation = useDeletePrinter();
  const testMutation = useTestPrinter();

  const resetForm = () => setForm(emptyForm);

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (printer: Printer) => {
    setEditing(printer);
    setForm({
      name: printer.name,
      connectionType: printer.connectionType,
      ip: printer.ip,
      port: printer.port,
      paperSize: printer.paperSize,
      purpose: printer.purpose,
      copies: printer.copies,
      isDefault: printer.isDefault,
      enabled: printer.enabled,
      bluetoothName: printer.bluetoothName || '',
      usbVendorId: printer.usbVendorId || '',
      usbProductId: printer.usbProductId || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire('Nama wajib diisi', '', 'warning');
      return;
    }
    if (form.connectionType === 'network' && !form.ip.trim()) {
      Swal.fire('IP wajib diisi', 'Printer jaringan membutuhkan alamat IP', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form });
      } else {
        await createMutation.mutateAsync(form);
      }
      setShowModal(false);
      Swal.fire({ title: 'Tersimpan', icon: 'success', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Gagal menyimpan', err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (printer: Printer) => {
    Swal.fire({
      title: 'Uji cetak...',
      text: 'Mengirim halaman uji cetak',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const result = await testMutation.mutateAsync(printer.id);
      if (result.error) {
        Swal.fire('Gagal', result.error, 'error');
        return;
      }
      if (result.clientPrint && result.buffer) {
        const clientResult = await printViaClient(result.printer as Printer, result.buffer);
        if (!clientResult.ok) {
          Swal.fire('Perlu Peramban', clientResult.error || 'Cetak USB/Bluetooth gagal', 'warning');
          return;
        }
      }
      Swal.fire('Berhasil', 'Halaman uji cetak terkirim ke printer', 'success');
    } catch (err) {
      Swal.fire('Gagal', err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    }
  };

  const handleDelete = async (printer: Printer) => {
    const result = await Swal.fire({
      title: `Hapus ${printer.name}?`,
      text: 'Printer akan dihapus dari konfigurasi',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (result.isConfirmed) {
      await deleteMutation.mutateAsync(printer.id);
      Swal.fire({ title: 'Terhapus', icon: 'success', timer: 1200, showConfirmButton: false });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pengaturan Printer</h1>
          <p className="text-sm text-gray-400 mt-1">
            Konfigurasi printer struk &amp; KOT. Printer jaringan dicetak dari server; USB/Bluetooth memakai peramban kasir (Chrome/Edge + HTTPS).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="blue-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
        >
          + Tambah Printer
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : printers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500">Belum ada printer dikonfigurasi.</p>
          <p className="text-sm text-gray-400 mt-1">Tambahkan printer pertama untuk mengaktifkan cetak otomatis.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {printers.map((printer) => (
            <div key={printer.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg ${printer.enabled ? 'bg-blue-50' : 'bg-gray-100'}`}>
                  {printer.connectionType === 'network' ? '🌐' : printer.connectionType === 'usb' ? '🔌' : '📡'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{printer.name}</p>
                    {printer.isDefault && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">DEFAULT</span>
                    )}
                    {!printer.enabled && (
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">NONAKTIF</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {connectionLabels[printer.connectionType]}
                    {printer.connectionType === 'network' && ` · ${printer.ip}:${printer.port}`}
                    {' · '}
                    {paperLabels[printer.paperSize]} · {purposeLabel(printer.purpose)} · {printer.copies}x
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTest(printer)}
                  disabled={testMutation.isPending}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Uji Cetak
                </button>
                <button
                  onClick={() => openEdit(printer)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-blue-600 hover:bg-blue-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(printer)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-red-500 hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Printer' : 'Tambah Printer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Nama Printer</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Kasir 1 / Dapur"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Tipe Koneksi</label>
                  <select
                    value={form.connectionType}
                    onChange={(e) => setForm({ ...form, connectionType: e.target.value as PrinterConnectionType })}
                    className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="network">Jaringan (IP)</option>
                    <option value="usb">USB</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Fungsi</label>
                  <select
                    value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value as PrinterPurpose })}
                    className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="receipt">Struk</option>
                    <option value="kot">KOT (Dapur)</option>
                  </select>
                </div>
              </div>

              {form.connectionType === 'network' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Alamat IP</label>
                    <input
                      value={form.ip}
                      onChange={(e) => setForm({ ...form, ip: e.target.value })}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="192.168.1.50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Port</label>
                    <input
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 9100 })}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {form.connectionType === 'bluetooth' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Nama Perangkat Bluetooth (opsional)</label>
                  <input
                    value={form.bluetoothName}
                    onChange={(e) => setForm({ ...form, bluetoothName: e.target.value })}
                    className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Tidak wajib — perangkat dipilih saat cetak pertama"
                  />
                </div>
              )}

              {form.connectionType === 'usb' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Vendor ID (hex)</label>
                    <input
                      value={form.usbVendorId}
                      onChange={(e) => setForm({ ...form, usbVendorId: e.target.value })}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                      placeholder="0456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Product ID (hex)</label>
                    <input
                      value={form.usbProductId}
                      onChange={(e) => setForm({ ...form, usbProductId: e.target.value })}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                      placeholder="0808"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Ukuran Kertas</label>
                  <select
                    value={form.paperSize}
                    onChange={(e) => setForm({ ...form, paperSize: e.target.value as PrinterPaperSize })}
                    className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="thermal80">Thermal 80mm</option>
                    <option value="thermal58">Thermal 58mm</option>
                    <option value="a4-portrait">A4 Portrait</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Jumlah Salinan</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.copies}
                    onChange={(e) => setForm({ ...form, copies: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                    className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Jadikan Default</p>
                    <p className="text-xs text-gray-400">Dipilih otomatis untuk fungsi ini</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="w-5 h-5 accent-blue-600"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Aktif</p>
                    <p className="text-xs text-gray-400">Nonaktifkan untuk menghentikan penggunaan tanpa menghapus</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="w-5 h-5 accent-blue-600"
                  />
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="blue-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
