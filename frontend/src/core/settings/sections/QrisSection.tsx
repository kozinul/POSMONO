import { useState } from 'react';
import { useUpdateSettings } from '../../../@shared/hooks/useTenant';
import { api } from '../../../@shared/services/api';

export interface QrisSectionProps {
  qrisGatewayEnabled: boolean;
  setQrisGatewayEnabled: (value: boolean) => void;
  qrisGatewayBaseUrl: string;
  setQrisGatewayBaseUrl: (value: string) => void;
  qrisGatewayApiKey: string;
  setQrisGatewayApiKey: (value: string) => void;
  qrisGatewayMerchantId: string;
  setQrisGatewayMerchantId: (value: string) => void;
  qrisComplete: boolean;
}

export default function QrisSection({
  qrisGatewayEnabled,
  setQrisGatewayEnabled,
  qrisGatewayBaseUrl,
  setQrisGatewayBaseUrl,
  qrisGatewayApiKey,
  setQrisGatewayApiKey,
  qrisGatewayMerchantId,
  setQrisGatewayMerchantId,
  qrisComplete,
}: QrisSectionProps) {
  const updateSettings = useUpdateSettings();
  const [testingQris, setTestingQris] = useState(false);
  const [qrisTestResult, setQrisTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestQris = async () => {
    setTestingQris(true);
    setQrisTestResult(null);
    try {
      await updateSettings.mutateAsync({
        qrisGatewayEnabled,
        qrisGatewayBaseUrl: qrisGatewayBaseUrl.trim(),
        qrisGatewayApiKey: qrisGatewayApiKey.trim(),
        qrisGatewayMerchantId: qrisGatewayMerchantId.trim(),
      });
      const res = await api.post('/payments/qris/test-config');
      const d = res.data?.data;
      setQrisTestResult({ ok: !!d?.ok, message: d?.message || 'Koneksi ke QRIS Gateway berhasil.' });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Gagal menghubungi QRIS Gateway.';
      setQrisTestResult({ ok: false, message: msg });
    } finally {
      setTestingQris(false);
    }
  };

  return (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">QRIS Gateway</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Pembayaran QRIS dinamis (QR berisi nominal) melalui gateway pihak ketiga</p>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Aktifkan QRIS Gateway</p>
                      <p className="text-sm text-gray-400">Kasir dapat menerima pembayaran QRIS dengan QR unik per transaksi</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qrisGatewayEnabled}
                        onChange={(e) => {
                          setQrisGatewayEnabled(e.target.checked);
                          setQrisTestResult(null);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {qrisGatewayEnabled && (
                    <>
                      <div className="border-t border-gray-100" />
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1.5">Base URL</label>
                          <input
                            value={qrisGatewayBaseUrl}
                            onChange={(e) => { setQrisGatewayBaseUrl(e.target.value); setQrisTestResult(null); }}
                            placeholder="http://host.docker.internal:3334"
                            className={`block w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              qrisGatewayBaseUrl.trim() ? 'border-gray-200' : 'border-red-300 bg-red-50/40'
                            }`}
                          />
                          <p className="text-xs text-gray-400 mt-1">Alamat REST gateway, tanpa garis miring di akhir</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">API Key</label>
                            <input
                              type="password"
                              value={qrisGatewayApiKey}
                              onChange={(e) => { setQrisGatewayApiKey(e.target.value); setQrisTestResult(null); }}
                              placeholder="••••••••"
                              autoComplete="off"
                              className={`block w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                qrisGatewayApiKey.trim() ? 'border-gray-200' : 'border-red-300 bg-red-50/40'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">Merchant ID</label>
                            <input
                              value={qrisGatewayMerchantId}
                              onChange={(e) => { setQrisGatewayMerchantId(e.target.value); setQrisTestResult(null); }}
                              placeholder="123456"
                              className={`block w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                qrisGatewayMerchantId.trim() ? 'border-gray-200' : 'border-red-300 bg-red-50/40'
                              }`}
                            />
                          </div>
                        </div>

                        {!qrisComplete && (
                          <p className="text-xs font-medium text-red-500">
                            Lengkapi Base URL, API Key, dan Merchant ID untuk mengaktifkan QRIS Gateway.
                          </p>
                        )}

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={handleTestQris}
                            disabled={testingQris || !qrisComplete}
                            className="px-5 py-2 rounded-lg font-semibold text-sm text-white blue-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testingQris ? 'Menguji...' : 'Uji Koneksi'}
                          </button>
                          <p className="text-xs text-gray-400">Konfigurasi disimpan sebelum pengujian (gateway dibuat & void invoice Rp 10.000)</p>
                        </div>

                        {qrisTestResult && (
                          <div className={`rounded-lg p-3 border ${qrisTestResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <p className={`text-sm font-medium ${qrisTestResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                              {qrisTestResult.ok ? '✓ ' : ''}{qrisTestResult.message}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>
  );
}
