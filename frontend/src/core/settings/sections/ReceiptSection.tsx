import type { ChangeEvent } from 'react';

export interface ReceiptSectionProps {
  receiptLogo: string;
  setReceiptLogo: (value: string) => void;
  receiptFooter: string;
  setReceiptFooter: (value: string) => void;
  autoPrintReceipt: boolean;
  setAutoPrintReceipt: (value: boolean) => void;
  autoPrintKot: boolean;
  setAutoPrintKot: (value: boolean) => void;
}

export default function ReceiptSection({
  receiptLogo,
  setReceiptLogo,
  receiptFooter,
  setReceiptFooter,
  autoPrintReceipt,
  setAutoPrintReceipt,
  autoPrintKot,
  setAutoPrintKot,
}: ReceiptSectionProps) {
  const handleLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptLogo(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Struk & Cetak</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Logo dan pesan yang muncul di struk pembayaran</p>
                </div>
                <div className="px-6 py-5 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo Struk</label>
                    <p className="text-xs text-gray-400 mb-2">Tampil di bagian atas struk. Unggah gambar atau tempel URL gambar.</p>
                    <div className="flex items-center gap-4">
                      {receiptLogo ? (
                        <div className="w-20 h-20 rounded-lg border border-gray-200 bg-white p-1.5 flex items-center justify-center overflow-hidden">
                          <img src={receiptLogo} alt="Logo struk" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={receiptLogo}
                          onChange={(e) => setReceiptLogo(e.target.value)}
                          className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="https://... atau data:image/png;base64,..."
                        />
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Unggah Gambar
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                        </label>
                        {receiptLogo && (
                          <button type="button" onClick={() => setReceiptLogo('')} className="text-xs text-red-500 hover:text-red-700">
                            Hapus logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Footer Struk</label>
                    <p className="text-xs text-gray-400 mb-2">Pesan yang muncul di bagian bawah struk pembayaran</p>
                    <textarea
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      rows={3}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Terima kasih telah berbelanja"
                    />
                  </div>

                  <div className="border-t border-gray-100" />

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Cetak Otomatis</h3>
                    <p className="text-xs text-gray-400 mb-3">
                      Printer harus dikonfigurasi di halaman <span className="font-medium">Pengaturan &gt; Printer</span>. Struk dicetak
                      server-side untuk printer jaringan; printer USB/Bluetooth memakai peramban kasir.
                    </p>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">Struk Otomatis</p>
                          <p className="text-sm text-gray-400">Cetak struk setiap transaksi selesai dibayar</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoPrintReceipt}
                            onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">KOT Otomatis</p>
                          <p className="text-sm text-gray-400">Cetak Kitchen Order Ticket saat pesanan dikonfirmasi</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoPrintKot}
                            onChange={(e) => setAutoPrintKot(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
  );
}
