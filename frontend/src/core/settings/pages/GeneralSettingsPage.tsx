import { useState, useEffect, useMemo } from 'react';
import { useTenant, useUpdateSettings, useUpdateProfile } from '../../../@shared/hooks/useTenant';
import { useTaxConfiguration, useAddTaxRule, useDeleteTaxRule, useCalculateTax } from '../../../@shared/hooks/useTaxConfiguration';

const sections = [
  {
    id: 'profile',
    label: 'Profil Toko',
    keywords: 'nama toko alamat telepon kategori bisnis informasi',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'tax',
    label: 'Pajak & Service',
    keywords: 'ppn pajak service charge biaya pelayanan tarif',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'discount',
    label: 'Batas Diskon',
    keywords: 'diskon maksimal batas persen nominal potongan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M9.568 3.563a2.25 2.25 0 014.864 0l.22 1.1a2.25 2.25 0 001.85 1.635l1.118.163a2.25 2.25 0 011.315 3.896l-.778.695a2.25 2.25 0 00-.715 2.121l.183.929a2.25 2.25 0 01-2.263 2.706l-1.076-.088a2.25 2.25 0 00-1.956 1.078l-.556.932a2.25 2.25 0 01-4.008 0l-.556-.932a2.25 2.25 0 00-1.956-1.078l-1.076.088a2.25 2.25 0 01-2.263-2.706l.183-.929a2.25 2.25 0 00-.715-2.121l-.778-.695a2.25 2.25 0 011.315-3.896l1.118-.163a2.25 2.25 0 001.85-1.635l.22-1.1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 15l6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'tax-rules',
    label: 'Aturan Pajak',
    keywords: 'tax rules compound pajak bertingkat kategori produk bebas pajak exemption multi rule',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'receipt',
    label: 'Struk & Cetak',
    keywords: 'footer struk receipt pesan cetak printer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M6.72 14.25c.416-2.105 2.123-3.75 4.28-3.75s3.864 1.645 4.28 3.75M6.72 14.25H6.5A2.25 2.25 0 004.25 16.5v4.5A2.25 2.25 0 006.5 23.25h11A2.25 2.25 0 0019.75 21v-4.5a2.25 2.25 0 00-2.25-2.25h-.22M6.72 14.25A5.25 5.25 0 1112 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function GeneralSettingsPage() {
  const { data: tenant, isLoading } = useTenant();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();

  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('profile');

  const [name, setName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ppnEnabled, setPpnEnabled] = useState(true);
  const [ppnRate, setPpnRate] = useState(11);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState(5);
  const [serviceChargeName, setServiceChargeName] = useState('Service Charge');
  const [discountMaxPercent, setDiscountMaxPercent] = useState(100);
  const [discountMaxNominal, setDiscountMaxNominal] = useState(1_000_000);
  const [receiptFooter, setReceiptFooter] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: taxConfig, isLoading: taxLoading } = useTaxConfiguration();
  const addRule = useAddTaxRule();
  const deleteRule = useDeleteTaxRule();
  const calcTax = useCalculateTax();

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'percentage' | 'compound' | 'exemption'>('percentage');
  const [newRuleRate, setNewRuleRate] = useState(0);
  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [addingRule, setAddingRule] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name || '');
    setBusinessCategory(tenant.businessCategory || '');
    setAddress(tenant.address || '');
    setPhone(tenant.phone || '');
    setPpnEnabled(tenant.config.ppnEnabled);
    setPpnRate(Math.round((tenant.config.ppnRate || 0) * 100));
    setServiceChargeEnabled(tenant.config.serviceChargeEnabled);
    setServiceChargeRate(Math.round((tenant.config.serviceChargeRate || 0) * 100));
    setServiceChargeName(tenant.config.serviceChargeName || 'Service Charge');
    setDiscountMaxPercent(tenant.config.discountMaxPercent ?? 100);
    setDiscountMaxNominal(tenant.config.discountMaxNominal ?? 1_000_000);
    setReceiptFooter(tenant.config.receiptFooter || '');
  }, [tenant]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keywords.toLowerCase().includes(q),
    );
  }, [search]);

  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.find((s) => s.id === activeSection)) {
      setActiveSection(filteredSections[0].id);
    }
  }, [filteredSections, activeSection]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        updateProfile.mutateAsync({ name, businessCategory, address, phone }),
        updateSettings.mutateAsync({
          ppnEnabled,
          ppnRate: ppnRate / 100,
          serviceChargeEnabled,
          serviceChargeRate: serviceChargeRate / 100,
          serviceChargeName,
          discountMaxPercent,
          discountMaxNominal,
          receiptFooter,
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Top Bar */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 shrink-0">Pengaturan</h1>
          <div className="flex-1 relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              placeholder="Cari pengaturan..."
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`shrink-0 px-5 py-2 rounded-lg font-semibold text-sm text-white transition-all ${
              saved ? 'bg-green-500' : 'blue-primary hover:opacity-90'
            } disabled:opacity-50`}
          >
            {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium shrink-0 animate-pulse">
              ✓
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto py-4">
          {filteredSections.length === 0 ? (
            <p className="px-4 text-sm text-gray-400">Tidak ada pengaturan</p>
          ) : (
            <ul className="space-y-0.5 px-2">
              {filteredSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className={activeSection === section.id ? 'text-blue-600' : 'text-gray-400'}>
                      {section.icon}
                    </span>
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-3xl mx-auto p-6 space-y-8 pb-12">
            {activeSection === 'profile' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Profil Toko</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Informasi dasar bisnis Anda</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">Nama Toko</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">Kategori Bisnis</label>
                      <select
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Pilih kategori</option>
                        <option value="makanan">Makanan & Minuman</option>
                        <option value="minuman">Minuman / Coffee Shop</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="snack">Snack / Cemilan</option>
                        <option value="retail">Retail / Sembako</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Alamat</label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Telepon</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="08xx-xxxx-xxxx"
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'tax' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Pajak & Service Charge</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Aturan perpajakan dan service charge sesuai Indonesia</p>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">PPN (Pajak Pertambahan Nilai)</p>
                      <p className="text-sm text-gray-400">Pajak untuk bisnis yang sudah ber-PKP</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ppnEnabled}
                        onChange={(e) => setPpnEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                  {ppnEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">Tarif PPN (%)</label>
                      <input
                        type="number"
                        value={ppnRate}
                        onChange={(e) => setPpnRate(Number(e.target.value))}
                        min={0}
                        max={100}
                        className="block w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Standar PPN Indonesia: 11% (2022-sekarang)</p>
                    </div>
                  )}

                  <div className="border-t border-gray-100" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Service Charge</p>
                      <p className="text-sm text-gray-400">Biaya pelayanan untuk restoran / kafe</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={serviceChargeEnabled}
                        onChange={(e) => setServiceChargeEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                  {serviceChargeEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Tarif Service Charge (%)</label>
                        <input
                          type="number"
                          value={serviceChargeRate}
                          onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                          min={0}
                          max={100}
                          className="block w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Nama Tampilan</label>
                        <input
                          value={serviceChargeName}
                          onChange={(e) => setServiceChargeName(e.target.value)}
                          className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSection === 'discount' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Batas Diskon</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Batasan maksimal diskon untuk mencegah kesalahan kasir</p>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Maks Diskon (%)</label>
                    <input
                      type="number"
                      value={discountMaxPercent}
                      onChange={(e) => setDiscountMaxPercent(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Maks Diskon (Rp)</label>
                    <input
                      type="number"
                      value={discountMaxNominal}
                      onChange={(e) => setDiscountMaxNominal(Number(e.target.value))}
                      min={0}
                      className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'tax-rules' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Aturan Pajak</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Kelola aturan pajak aktif untuk toko Anda</p>
                </div>

                {/* Active Rules List */}
                <div className="px-6 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Aturan Aktif</h3>
                  {taxLoading ? (
                    <div className="text-sm text-gray-400">Memuat...</div>
                  ) : !taxConfig || taxConfig.rules.length === 0 ? (
                    <div className="text-sm text-gray-400">Belum ada aturan pajak. Tambahkan aturan baru.</div>
                  ) : (
                    <div className="space-y-2">
                      {taxConfig.rules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{rule.name}</p>
                              <p className="text-xs text-gray-400">
                                {rule.type === 'compound' ? 'Compound' : rule.type === 'percentage' ? 'Persentase' : rule.type === 'exemption' ? 'Pengecualian' : rule.type} — {rule.rate}%
                                {rule.calculationStrategy === 'indonesia_ppn_2025' && ' · DPP Nilai Lain (11/12)'}
                                {rule.calculationStrategy === 'standard_percentage' && ' · Standar'}
                                {rule.applyTo !== 'all' && ` · ${rule.applyTo === 'categories' ? 'Per kategori' : 'Per produk'}`}
                                {rule.compoundOrder > 0 && ` · Urutan: ${rule.compoundOrder}`}
                              </p>
                            </div>
                          </div>
                          {rule.isActive && (
                            <button
                              onClick={() => deleteRule.mutate(rule.id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Hapus aturan"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Rule */}
                <div className="px-6 py-4 border-b border-gray-50">
                  <button
                    onClick={() => setAddingRule(!addingRule)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {addingRule ? 'Batal' : '+ Tambah Aturan Pajak'}
                  </button>

                  {addingRule && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Aturan</label>
                          <input
                            value={newRuleName}
                            onChange={(e) => setNewRuleName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="PPN, VAT, GST..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                          <select
                            value={newRuleType}
                            onChange={(e) => setNewRuleType(e.target.value as any)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="percentage">Persentase</option>
                            <option value="compound">Compound</option>
                            <option value="exemption">Pengecualian</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tarif (%)</label>
                        <input
                          type="number"
                          value={newRuleRate}
                          onChange={(e) => setNewRuleRate(Number(e.target.value))}
                          min={0}
                          max={100}
                          className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!newRuleName || newRuleRate <= 0) return;
                          await addRule.mutateAsync({
                            name: newRuleName,
                            type: newRuleType,
                            rate: newRuleRate,
                            calculationStrategy: newRuleType === 'compound' ? 'compound' : 'standard_percentage',
                            taxBaseModifier: null,
                            compoundOrder: newRuleType === 'compound' ? 1 : 0,
                            applyTo: 'all',
                            categoryIds: [],
                            productIds: [],
                            exemptProductIds: [],
                            exemptCustomerTags: [],
                            isActive: true,
                          });
                          setNewRuleName('');
                          setNewRuleRate(0);
                          setAddingRule(false);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Simpan Aturan
                      </button>
                    </div>
                  )}
                </div>

                {/* Test Calculator */}
                <div className="px-6 py-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Kalkulator Uji Coba</h3>
                  <p className="text-xs text-gray-400 mb-3">Masukkan nominal untuk melihat hasil perhitungan pajak</p>
                  <div className="flex gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Total Belanja (Rp)</label>
                      <input
                        type="number"
                        id="calc-amount"
                        defaultValue={100000}
                        className="block w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const el = document.getElementById('calc-amount') as HTMLInputElement;
                        const amount = parseInt(el?.value || '0');
                        const result = await calcTax.mutateAsync({
                          items: [{ productId: 'test', productName: 'Sample', quantity: 1, unitPrice: amount }],
                        });
                        setCalcResult(
                          `Subtotal: Rp${result.subtotal.toLocaleString()} | Pajak: Rp${result.totalTax.toLocaleString()} | Service: Rp${result.serviceCharge.toLocaleString()} | Total: Rp${result.grandTotal.toLocaleString()}`
                        );
                      }}
                      className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
                    >
                      Hitung
                    </button>
                  </div>
                  {calcResult && (
                    <p className="mt-3 text-sm text-gray-700 bg-blue-50 px-4 py-3 rounded-lg">{calcResult}</p>
                  )}
                </div>
              </section>
            )}

            {activeSection === 'receipt' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Footer Struk</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Pesan yang muncul di bagian bawah struk pembayaran</p>
                </div>
                <div className="px-6 py-5">
                  <textarea
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    rows={3}
                    className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Terima kasih telah berbelanja"
                  />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}