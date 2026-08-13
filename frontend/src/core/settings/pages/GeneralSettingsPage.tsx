import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useTenant, useUpdateSettings, useUpdateProfile } from '../../../@shared/hooks/useTenant';
import { useTaxConfiguration, useUpdateTaxConfiguration, useAddTaxRule, useDeleteTaxRule, useAddCharge, useUpdateCharge, useDeleteCharge, useCalculateTax } from '../../../@shared/hooks/useTaxConfiguration';
import type { IModifierConfig, IChargeConfig } from '../../../@shared/hooks/useTaxConfiguration';
import { usePricingProfiles, useCreatePricingProfile, useUpdatePricingProfile, useDeletePricingProfile } from '../../../@shared/hooks/usePricingProfile';

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
    keywords: 'pajak service charge biaya pelayanan tarif pricing mode inclusive exclusive',
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
    id: 'pricing-profiles',
    label: 'Profil Harga',
    keywords: 'pricing profile tax rules group pajak kategori produk aturan harga grouping',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M9.568 3.563a2.25 2.25 0 014.864 0l.22 1.1a2.25 2.25 0 001.85 1.635l1.118.163a2.25 2.25 0 011.315 3.896l-.778.695a2.25 2.25 0 00-.715 2.121l.183.929a2.25 2.25 0 01-2.263 2.706l-1.076-.088a2.25 2.25 0 00-1.956 1.078l-.556.932a2.25 2.25 0 01-4.008 0l-.556-.932a2.25 2.25 0 00-1.956-1.078l-1.076.088a2.25 2.25 0 01-2.263-2.706l.183-.929a2.25 2.25 0 00-.715-2.121l-.778-.695a2.25 2.25 0 011.315-3.896l1.118-.163a2.25 2.25 0 001.85-1.635l.22-1.1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 9l-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'rounding',
    label: 'Pembulatan',
    keywords: 'pembulatan rounding pembulatan total genap rupiah 500 1000 tunai cash',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM12 21c4.5 0 7.5-2.4 7.5-6.75 0-1.875-1.08-3.135-2.465-4.072A8.25 8.25 0 0012 8.25c-2.32 0-4.5 1.5-4.5 3.6 0 1.656 1.08 3.6 2.51 4.1A4.72 4.72 0 0111.25 18h.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'charges',
    label: 'Biaya Tambahan',
    keywords: 'service charge biaya delivery ongkir fee tambahan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M9.568 3.563a2.25 2.25 0 014.864 0l.22 1.1a2.25 2.25 0 001.85 1.635l1.118.163a2.25 2.25 0 011.315 3.896l-.778.695a2.25 2.25 0 00-.715 2.121l.183.929a2.25 2.25 0 01-2.263 2.706l-1.076-.088a2.25 2.25 0 00-1.956 1.078l-.556.932a2.25 2.25 0 01-4.008 0l-.556-.932a2.25 2.25 0 00-1.956-1.078l-1.076.088a2.25 2.25 0 01-2.263-2.706l.183-.929a2.25 2.25 0 00-.715-2.121l-.778-.695a2.25 2.25 0 011.315-3.896l1.118-.163a2.25 2.25 0 001.85-1.635l.22-1.1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" />
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

function getActiveRules(taxConfig: { versions: Array<{ id: string; rules: Array<any> }>; activeVersionId: string } | undefined) {
  if (!taxConfig) return [];
  const activeVer = taxConfig.versions.find((v) => v.id === taxConfig.activeVersionId);
  return activeVer?.rules ?? [];
}

function getActiveCharges(taxConfig: { versions: Array<{ id: string; charges?: Array<any> }>; activeVersionId: string } | undefined) {
  if (!taxConfig) return [];
  const activeVer = taxConfig.versions.find((v) => v.id === taxConfig.activeVersionId);
  return activeVer?.charges ?? [];
}

function formatRounding(value: number): string {
  return value.toLocaleString('id-ID');
}

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

  // Tax config state (from new tax module)
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [pricingMode, setPricingMode] = useState<'inclusive' | 'exclusive'>('exclusive');
  const [ppnEnabled, setPpnEnabled] = useState(false);
  const [ppnRate, setPpnRate] = useState(11);
  const [ppnModifierType, setPpnModifierType] = useState<'none' | 'fraction' | 'multiplier' | 'fixed_deduction'>('fraction');
  const [ppnModifierNumerator, setPpnModifierNumerator] = useState(11);
  const [ppnModifierDenominator, setPpnModifierDenominator] = useState(12);


  const [discountMaxPercent, setDiscountMaxPercent] = useState(100);
  const [discountMaxNominal, setDiscountMaxNominal] = useState(1_000_000);
  const [receiptFooter, setReceiptFooter] = useState('');
  const [receiptLogo, setReceiptLogo] = useState('');
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [roundingMode, setRoundingMode] = useState<'nearest' | 'up' | 'down'>('nearest');
  const [roundingDenomination, setRoundingDenomination] = useState(0);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [autoPrintKot, setAutoPrintKot] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: taxConfig, isLoading: taxLoading } = useTaxConfiguration();
  const updateTaxConfig = useUpdateTaxConfiguration();
  const addRule = useAddTaxRule();
  const deleteRule = useDeleteTaxRule();
  const addCharge = useAddCharge();
  const updateCharge = useUpdateCharge();
  const deleteCharge = useDeleteCharge();
  const calcTax = useCalculateTax();

  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [addingRule, setAddingRule] = useState(false);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTaxType, setNewRuleTaxType] = useState<'vat' | 'withholding' | 'custom' | 'exemption'>('vat');
  const [newRuleRate, setNewRuleRate] = useState(0);
  const [calcMode, setCalcMode] = useState<'standard' | 'custom'>('standard');
  const [modifierType, setModifierType] = useState<'none' | 'fraction' | 'multiplier' | 'fixed_deduction'>('none');
  const [modifierNumerator, setModifierNumerator] = useState(11);
  const [modifierDenominator, setModifierDenominator] = useState(12);
  const [modifierMultiplier, setModifierMultiplier] = useState(0.8);
  const [modifierDeduction, setModifierDeduction] = useState(0);

  const [addingCharge, setAddingCharge] = useState(false);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeType, setNewChargeType] = useState<'rate' | 'flat'>('rate');
  const [newChargeRate, setNewChargeRate] = useState(0);
  const [newChargeAmount, setNewChargeAmount] = useState(0);
  const [newChargeIncludeInTaxBase, setNewChargeIncludeInTaxBase] = useState(true);

  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeName, setEditChargeName] = useState('');
  const [editChargeType, setEditChargeType] = useState<'rate' | 'flat'>('rate');
  const [editChargeRate, setEditChargeRate] = useState(0);
  const [editChargeAmount, setEditChargeAmount] = useState(0);
  const [editChargeIncludeInTaxBase, setEditChargeIncludeInTaxBase] = useState(true);

  const { data: pricingProfiles, isLoading: profilesLoading } = usePricingProfiles();
  const createProfile = useCreatePricingProfile();
  const updatePricingProfile = useUpdatePricingProfile();
  const deletePricingProfile = useDeletePricingProfile();
  const [profileForm, setProfileForm] = useState<{ name: string; description: string; taxRuleIds: string[]; isDefault: boolean } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const activeRules = useMemo(() => getActiveRules(taxConfig), [taxConfig]);
  const activeCharges = useMemo(() => getActiveCharges(taxConfig), [taxConfig]);

  // Init state from taxConfig
  useEffect(() => {
    if (!taxConfig) return;
    setTaxEnabled(taxConfig.taxEnabled);
    setPricingMode(taxConfig.pricingMode);
    const vatRule = activeRules.find((r) => r.taxType === 'vat');
    setPpnEnabled(!!vatRule);
    if (vatRule) {
      setPpnRate(vatRule.policy.value);
      const m = vatRule.modifier;
      if (m) {
        setPpnModifierType(m.type);
        if (m.config?.numerator) setPpnModifierNumerator(m.config.numerator);
        if (m.config?.denominator) setPpnModifierDenominator(m.config.denominator);
      }
    }
  }, [taxConfig, activeRules, activeCharges]);

  // Init tenant profile
  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name || '');
    setBusinessCategory(tenant.businessCategory || '');
    setAddress(tenant.address || '');
    setPhone(tenant.phone || '');
    setDiscountMaxPercent(tenant.config.discountMaxPercent ?? 100);
    setDiscountMaxNominal(tenant.config.discountMaxNominal ?? 1_000_000);
    setReceiptFooter(tenant.config.receiptFooter || '');
    setReceiptLogo(tenant.config.receiptLogo || '');
    setRoundingEnabled(tenant.config.roundingEnabled ?? false);
    setRoundingMode(tenant.config.roundingMode ?? 'nearest');
    setRoundingDenomination(tenant.config.roundingDenomination ?? 0);
    setAutoPrintReceipt(tenant.config.autoPrintReceipt ?? true);
    setAutoPrintKot(tenant.config.autoPrintKot ?? false);
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

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptLogo(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const promises: Promise<any>[] = [
        updateProfile.mutateAsync({ name, businessCategory, address, phone }),
        updateSettings.mutateAsync({
          discountMaxPercent,
          discountMaxNominal,
          receiptFooter,
          receiptLogo,
          roundingEnabled,
          roundingMode,
          roundingDenomination,
          autoPrintReceipt,
          autoPrintKot,
        }),
        updateTaxConfig.mutateAsync({ taxEnabled, pricingMode }),
      ];

      const existingVat = activeRules.find((r) => r.taxType === 'vat');

      // Sync PPN: create if enabled & missing, delete if disabled & exists
      if (taxEnabled && ppnEnabled && ppnRate > 0 && !existingVat) {
        const modifier: IModifierConfig | undefined = ppnModifierType === 'none'
          ? undefined
          : {
              type: ppnModifierType,
              config: ppnModifierType === 'fraction'
                ? { numerator: ppnModifierNumerator, denominator: ppnModifierDenominator }
                : ppnModifierType === 'multiplier'
                  ? { multiplier: 0.8 }
                  : { deduction: 0 },
            };
        promises.push(
          addRule.mutateAsync({
            id: `rule_vat_${Date.now()}`,
            name: `Pajak ${ppnRate}%`,
            taxType: 'vat',
            priority: 10,
            scope: { type: 'all', entityId: '', entityName: 'Semua' },
            policy: {
              type: 'percentage_of_base',
              value: ppnRate,
              roundingMode: 'round',
              precision: 2,
            },
            modifier,
            isActive: true,
            effectiveDate: new Date().toISOString(),
          }),
        );
      }
      if ((!taxEnabled || !ppnEnabled) && existingVat) {
        promises.push(deleteRule.mutateAsync(existingVat.id));
      }

      await Promise.all(promises);
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
                  {/* Tax Enabled */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Aktifkan Pajak</p>
                      <p className="text-sm text-gray-400">Hitung pajak otomatis untuk setiap transaksi</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxEnabled}
                        onChange={(e) => setTaxEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Pricing Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Mode Harga</label>
                    <select
                      value={pricingMode}
                      onChange={(e) => setPricingMode(e.target.value as 'inclusive' | 'exclusive')}
                      className="block w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="exclusive">Exclusive (Pajak + harga = total)</option>
                      <option value="inclusive">Inclusive (Harga sudah termasuk pajak)</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {pricingMode === 'exclusive'
                        ? 'Pajak ditambahkan di atas harga barang'
                        : 'Harga barang sudah termasuk pajak (hanya service charge ditambahkan)'}
                    </p>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Tax Rate */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Tarif Pajak</p>
                      <p className="text-sm text-gray-400">Atur tarif pajak default untuk transaksi</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ppnEnabled}
                        onChange={(e) => {
                          setPpnEnabled(e.target.checked);
                          if (e.target.checked) setPpnRate(11);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                  {taxEnabled && ppnEnabled && (
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1.5">Tarif Pajak (%)</label>
                          <input
                            type="number"
                            value={ppnRate}
                            onChange={(e) => setPpnRate(Number(e.target.value))}
                            min={0}
                            max={100}
                            className="block w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1.5">Dasar Pengenaan Pajak (DPP)</label>
                          <select
                            value={ppnModifierType}
                            onChange={(e) => setPpnModifierType(e.target.value as any)}
                            className="block w-44 px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="none">Tanpa modifier (100%)</option>
                            <option value="fraction">Pecahan (a/b)</option>
                            <option value="multiplier">Multiplier</option>
                            <option value="fixed_deduction">Potongan tetap</option>
                          </select>
                        </div>
                      </div>
                      {ppnModifierType === 'fraction' && (
                        <div className="flex gap-3 items-end">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Pembilang (a)</label>
                            <input
                              type="number"
                              value={ppnModifierNumerator}
                              onChange={(e) => setPpnModifierNumerator(Number(e.target.value))}
                              className="block w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Penyebut (b)</label>
                            <input
                              type="number"
                              value={ppnModifierDenominator}
                              onChange={(e) => setPpnModifierDenominator(Number(e.target.value))}
                              className="block w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                      {ppnModifierType === 'fraction' && ppnModifierDenominator > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-800 mb-1">Perhitungan Efektif</p>
                          <p className="text-sm text-blue-700">
                            DPP = Harga × {ppnModifierNumerator}/{ppnModifierDenominator}
                            {ppnModifierDenominator > 0 && (
                              <> = Harga × {(ppnModifierNumerator / ppnModifierDenominator * 100).toFixed(2)}%</>
                            )}
                          </p>
                          <p className="text-sm text-blue-700 mt-1">
                            Pajak Efektif = {ppnRate}% × {ppnModifierNumerator}/{ppnModifierDenominator}
                            {ppnModifierDenominator > 0 && (
                              <> = {(ppnRate * ppnModifierNumerator / ppnModifierDenominator).toFixed(2)}%</>
                            )}
                          </p>
                        </div>
                      )}
                      {ppnModifierType !== 'fraction' && (
                        <p className="text-xs text-gray-400">
                          {ppnModifierType === 'none' 
                            ? `Pajak efektif: ${ppnRate}% dari harga jual.`
                            : ppnModifierType === 'multiplier'
                            ? `DPP = Harga × multiplier, lalu pajak ${ppnRate}% dari DPP.`
                            : `DPP = Harga - potongan tetap, lalu pajak ${ppnRate}% dari DPP.`
                          }
                        </p>
                      )}
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

            {activeSection === 'rounding' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Pembulatan Total</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Bulatkan total pembayaran tunai ke nominal yang genap</p>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Aktifkan Pembulatan</p>
                      <p className="text-sm text-gray-400">Berlaku hanya untuk pembayaran tunai (cash)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roundingEnabled}
                        onChange={(e) => setRoundingEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {roundingEnabled && (
                    <>
                      <div className="border-t border-gray-100" />
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Denominasi</label>
                        <select
                          value={roundingDenomination}
                          onChange={(e) => setRoundingDenomination(Number(e.target.value))}
                          className="block w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value={0}>Tidak ada pembulatan</option>
                          <option value={100}>Rp 100</option>
                          <option value={500}>Rp 500</option>
                          <option value={1000}>Rp 1.000</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          Total akan dibulatkan ke kelipatan {roundingDenomination > 0 ? `Rp ${formatRounding(roundingDenomination)}` : 'nominal yang dipilih'}.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Mode Pembulatan</label>
                        <select
                          value={roundingMode}
                          onChange={(e) => setRoundingMode(e.target.value as 'nearest' | 'up' | 'down')}
                          className="block w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="nearest">Terdekat (round)</option>
                          <option value="up">Ke Atas (ceil)</option>
                          <option value="down">Ke Bawah (floor)</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          {roundingMode === 'nearest'
                            ? 'Total dibulatkan ke kelipatan terdekat (mis. Rp 1.240 → Rp 1.200 atau Rp 1.300)'
                            : roundingMode === 'up'
                              ? 'Total selalu dibulatkan ke atas (mis. Rp 1.240 → Rp 1.300)'
                              : 'Total selalu dibulatkan ke bawah (mis. Rp 1.240 → Rp 1.200)'}
                        </p>
                      </div>
                    </>
                  )}
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
                  ) : activeRules.length === 0 ? (
                    <div className="text-sm text-gray-400">Belum ada aturan pajak. Tambahkan aturan baru.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeRules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{rule.name}</p>
                              <p className="text-xs text-gray-400">
                                {rule.taxType === 'vat' ? 'Pajak' : rule.taxType === 'withholding' ? 'PPh' : rule.taxType === 'exemption' ? 'Pengecualian' : rule.taxType} — {rule.policy.value}
                                {rule.policy.type !== 'amount' ? '%' : ''}
                                {rule.modifier && rule.modifier.type === 'fraction' && rule.modifier.config?.denominator > 0
                                  ? ` (efektif: ${(rule.policy.value * rule.modifier.config.numerator / rule.modifier.config.denominator).toFixed(2)}%)`
                                  : ''}
                                {rule.scope.type !== 'all' && ` · ${rule.scope.entityName}`}
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
                    onClick={() => {
                      if (addingRule) {
                        setAddingRule(false);
                        setCalcMode('standard');
                        setModifierType('none');
                      } else {
                        setAddingRule(true);
                      }
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {addingRule ? 'Batal' : '+ Tambah Aturan Pajak'}
                  </button>

                  {addingRule && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      {/* Presets */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Template Pajak</label>
                        <select
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'ppn') {
                              setNewRuleName('Pajak 12%');
                              setNewRuleTaxType('vat');
                              setNewRuleRate(12);
                              setCalcMode('custom');
                              setModifierType('fraction');
                              setModifierNumerator(11);
                              setModifierDenominator(12);
                            } else if (v === 'pph') {
                              setNewRuleName('PPh Pasal 23');
                              setNewRuleTaxType('withholding');
                              setNewRuleRate(2);
                              setCalcMode('standard');
                              setModifierType('none');
                            } else if (v === 'exempt') {
                              setNewRuleName('Bebas Pajak');
                              setNewRuleTaxType('exemption');
                              setNewRuleRate(0);
                              setCalcMode('standard');
                              setModifierType('none');
                            }
                          }}
                          defaultValue=""
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="" disabled>Pilih template...</option>
                          <option value="ppn">🇮🇩 Pajak Indonesia 12%</option>
                          <option value="pph">📋 PPh Pasal 23 (2%)</option>
                          <option value="exempt">✅ Bebas Pajak</option>
                          <option value="custom">⚙️ Kustom</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Pajak</label>
                          <input
                            value={newRuleName}
                            onChange={(e) => setNewRuleName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Pajak 12%"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                          <select
                            value={newRuleTaxType}
                            onChange={(e) => setNewRuleTaxType(e.target.value as any)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="vat">Pajak</option>
                            <option value="withholding">PPh</option>
                            <option value="custom">Kustom</option>
                            <option value="exemption">Pengecualian</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
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
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Metode Perhitungan</label>
                          <select
                            value={calcMode}
                            onChange={(e) => {
                              const mode = e.target.value as 'standard' | 'custom';
                              setCalcMode(mode);
                              if (mode === 'standard') setModifierType('none');
                            }}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="standard">Standard</option>
                            <option value="custom">Kustom</option>
                          </select>
                        </div>
                      </div>

                      {/* Custom Formula Section */}
                      {calcMode === 'custom' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Custom Modifier</h4>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Modifier</label>
                            <select
                              value={modifierType}
                              onChange={(e) => setModifierType(e.target.value as any)}
                              className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="none">None</option>
                              <option value="fraction">Fraction</option>
                              <option value="multiplier">Multiplier</option>
                              <option value="fixed_deduction">Fixed Deduction</option>
                            </select>
                          </div>

                          {modifierType === 'fraction' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Pembilang (Numerator)</label>
                                <input
                                  type="number"
                                  value={modifierNumerator}
                                  onChange={(e) => setModifierNumerator(Number(e.target.value))}
                                  className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Penyebut (Denominator)</label>
                                <input
                                  type="number"
                                  value={modifierDenominator}
                                  onChange={(e) => setModifierDenominator(Number(e.target.value))}
                                  className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          {modifierType === 'multiplier' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Nilai Pengali</label>
                              <input
                                type="number"
                                step={0.1}
                                value={modifierMultiplier}
                                onChange={(e) => setModifierMultiplier(Number(e.target.value))}
                                className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}

                          {modifierType === 'fixed_deduction' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Pengurangan Tetap (Rp)</label>
                              <input
                                type="number"
                                value={modifierDeduction}
                                onChange={(e) => setModifierDeduction(Number(e.target.value))}
                                className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}

                          {/* Formula Preview */}
                          {modifierType !== 'none' && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                              <p className="text-xs font-medium text-blue-700 mb-1">Preview Formula</p>
                              <p className="text-sm text-blue-800 font-mono">
                                {modifierType === 'fraction' && (
                                  <>Jumlah × ({modifierNumerator} / {modifierDenominator})</>
                                )}
                                {modifierType === 'multiplier' && (
                                  <>Jumlah × {modifierMultiplier}</>
                                )}
                                {modifierType === 'fixed_deduction' && (
                                  <>Jumlah − {modifierDeduction.toLocaleString()}</>
                                )}
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                Contoh: Rp100.000 → Rp
                                {modifierType === 'fraction' && ((100000 * modifierNumerator) / modifierDenominator).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {modifierType === 'multiplier' && (100000 * modifierMultiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {modifierType === 'fixed_deduction' && Math.max(0, 100000 - modifierDeduction).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={async () => {
                          if (!newRuleName || newRuleRate <= 0) return;
                          const modifier = calcMode === 'custom' && modifierType !== 'none'
                            ? {
                                type: modifierType,
                                config: modifierType === 'fraction'
                                  ? { numerator: modifierNumerator, denominator: modifierDenominator }
                                  : modifierType === 'multiplier'
                                  ? { multiplier: modifierMultiplier }
                                  : modifierType === 'fixed_deduction'
                                  ? { deduction: modifierDeduction }
                                  : {},
                              }
                            : undefined;
                          await addRule.mutateAsync({
                            id: `rule_${Date.now()}`,
                            name: newRuleName,
                            taxType: newRuleTaxType,
                            priority: 10,
                            scope: { type: 'all', entityId: '', entityName: 'Semua' },
                            policy: {
                              type: 'rate',
                              value: newRuleRate,
                              roundingMode: 'round',
                              precision: 2,
                            },
                            modifier,
                            isActive: true,
                            effectiveDate: new Date().toISOString(),
                          });
                          setNewRuleName('');
                          setNewRuleRate(0);
                          setCalcMode('standard');
                          setModifierType('none');
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
                        const tenantId = taxConfig?.tenantId ?? '';
                        const result = await calcTax.mutateAsync({
                          tenantId,
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

            {activeSection === 'charges' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Biaya Tambahan</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Kelola biaya service charge, delivery fee, dan biaya lainnya</p>
                </div>

                {/* Active Charges List */}
                <div className="px-6 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Biaya Aktif</h3>
                  {taxLoading ? (
                    <div className="text-sm text-gray-400">Memuat...</div>
                  ) : activeCharges.length === 0 ? (
                    <div className="text-sm text-gray-400">Belum ada biaya tambahan. Tambahkan biaya baru.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeCharges.map((charge) => (
                        <div key={charge.id}>
                          {editingChargeId === charge.id ? (
                            /* Edit Form */
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Nama Biaya</label>
                                  <input
                                    value={editChargeName}
                                    onChange={(e) => setEditChargeName(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                                  <select
                                    value={editChargeType}
                                    onChange={(e) => setEditChargeType(e.target.value as 'rate' | 'flat')}
                                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="rate">Persen (%)</option>
                                    <option value="flat">Nominal (Rp)</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {editChargeType === 'rate' ? (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarif (%)</label>
                                    <input
                                      type="number"
                                      value={editChargeRate}
                                      onChange={(e) => setEditChargeRate(Number(e.target.value))}
                                      min={0}
                                      max={100}
                                      className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                  </div>
                                ) : (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nominal (Rp)</label>
                                    <input
                                      type="number"
                                      value={editChargeAmount}
                                      onChange={(e) => setEditChargeAmount(Number(e.target.value))}
                                      min={0}
                                      className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                  </div>
                                )}
                                <div className="flex items-center gap-3">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editChargeIncludeInTaxBase}
                                      onChange={(e) => setEditChargeIncludeInTaxBase(e.target.checked)}
                                      className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                                  </label>
                                  <span className="text-xs text-gray-600">Include in Tax Base (DPP)</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    if (!editChargeName) return;
                                    await updateCharge.mutateAsync({
                                      chargeId: charge.id,
                                      partial: {
                                        name: editChargeName,
                                        rate: editChargeType === 'rate' ? editChargeRate : undefined,
                                        amount: editChargeType === 'flat' ? editChargeAmount : undefined,
                                        includeInTaxBase: editChargeIncludeInTaxBase,
                                      },
                                    });
                                    setEditingChargeId(null);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => setEditingChargeId(null)}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Charge Row */
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={charge.isActive}
                                    onChange={(e) => updateCharge.mutateAsync({
                                      chargeId: charge.id,
                                      partial: { isActive: e.target.checked },
                                    })}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                                </label>
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{charge.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {charge.rate != null ? `${charge.rate}%` : charge.amount != null ? `Rp ${(charge.amount as number).toLocaleString()}` : '-'}
                                    {charge.includeInTaxBase ? ' · Termasuk DPP' : ' · DPP tidak'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingChargeId(charge.id);
                                    setEditChargeName(charge.name);
                                    setEditChargeType(charge.rate != null ? 'rate' : 'flat');
                                    setEditChargeRate(charge.rate ?? 0);
                                    setEditChargeAmount((charge.amount as number) ?? 0);
                                    setEditChargeIncludeInTaxBase(charge.includeInTaxBase);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                  title="Edit biaya"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteCharge.mutate(charge.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                  title="Hapus biaya"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Charge */}
                <div className="px-6 py-4">
                  <button
                    onClick={() => {
                      if (addingCharge) {
                        setAddingCharge(false);
                        setNewChargeName('');
                        setNewChargeType('rate');
                        setNewChargeRate(0);
                        setNewChargeAmount(0);
                        setNewChargeIncludeInTaxBase(true);
                      } else {
                        setAddingCharge(true);
                      }
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {addingCharge ? 'Batal' : '+ Tambah Biaya'}
                  </button>

                  {addingCharge && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nama Biaya</label>
                          <input
                            value={newChargeName}
                            onChange={(e) => setNewChargeName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Service Charge"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                          <select
                            value={newChargeType}
                            onChange={(e) => setNewChargeType(e.target.value as 'rate' | 'flat')}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="rate">Persen (%)</option>
                            <option value="flat">Nominal (Rp)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {newChargeType === 'rate' ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tarif (%)</label>
                            <input
                              type="number"
                              value={newChargeRate}
                              onChange={(e) => setNewChargeRate(Number(e.target.value))}
                              min={0}
                              max={100}
                              className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nominal (Rp)</label>
                            <input
                              type="number"
                              value={newChargeAmount}
                              onChange={(e) => setNewChargeAmount(Number(e.target.value))}
                              min={0}
                              className="block w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newChargeIncludeInTaxBase}
                              onChange={(e) => setNewChargeIncludeInTaxBase(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                          </label>
                          <span className="text-xs text-gray-600">Include in Tax Base (DPP)</span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!newChargeName) return;
                          if (newChargeType === 'rate' && newChargeRate <= 0) return;
                          if (newChargeType === 'flat' && newChargeAmount <= 0) return;
                          await addCharge.mutateAsync({
                            id: `charge_${Date.now()}`,
                            name: newChargeName,
                            rate: newChargeType === 'rate' ? newChargeRate : undefined,
                            amount: newChargeType === 'flat' ? newChargeAmount : undefined,
                            includeInTaxBase: newChargeIncludeInTaxBase,
                            priority: activeCharges.length + 1,
                            isActive: true,
                            effectiveDate: new Date().toISOString(),
                          });
                          setNewChargeName('');
                          setNewChargeType('rate');
                          setNewChargeRate(0);
                          setNewChargeAmount(0);
                          setNewChargeIncludeInTaxBase(true);
                          setAddingCharge(false);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Simpan Biaya
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSection === 'pricing-profiles' && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Profil Harga</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Kelompok aturan pajak untuk produk dengan kategori harga berbeda</p>
                  </div>
                  <button
                    onClick={() => setProfileForm({ name: '', description: '', taxRuleIds: [], isDefault: false })}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    + Profil Baru
                  </button>
                </div>

                {profileForm && (
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{profileForm.name || 'Profil Baru'}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nama Profil</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Food & Beverage"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
                        <input
                          type="text"
                          value={profileForm.description}
                          onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Produk makanan dan minuman"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-2">Aturan Pajak</label>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                        {activeRules.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Belum ada aturan pajak. Buat di tab Aturan Pajak.</p>
                        ) : (
                          activeRules.map((rule) => (
                            <label key={rule.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={profileForm.taxRuleIds.includes(rule.id)}
                                onChange={(e) => {
                                  setProfileForm({
                                    ...profileForm,
                                    taxRuleIds: e.target.checked
                                      ? [...profileForm.taxRuleIds, rule.id]
                                      : profileForm.taxRuleIds.filter((id) => id !== rule.id),
                                  });
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{rule.name} ({rule.policy.value}%)</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="profile-default"
                        checked={profileForm.isDefault}
                        onChange={(e) => setProfileForm({ ...profileForm, isDefault: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="profile-default" className="text-sm text-gray-700">Jadikan default</label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={profileSaving || !profileForm.name.trim()}
                        onClick={async () => {
                          setProfileSaving(true);
                          try {
                            await createProfile.mutateAsync(profileForm);
                            setProfileForm(null);
                          } finally {
                            setProfileSaving(false);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {profileSaving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button
                        onClick={() => setProfileForm(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {profilesLoading ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">Memuat...</div>
                  ) : !pricingProfiles || pricingProfiles.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">Belum ada profil harga. Klik "+ Profil Baru" untuk membuat.</div>
                  ) : (
                    pricingProfiles.map((profile) => (
                      <div key={profile.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{profile.name}</span>
                            {profile.isDefault && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Default</span>
                            )}
                            {!profile.active && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Nonaktif</span>
                            )}
                          </div>
                          {profile.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{profile.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{profile.taxRuleIds.length} aturan pajak</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await updatePricingProfile.mutateAsync({ id: profile.id, active: !profile.active });
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                          >
                            {profile.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: 'Hapus profil?',
                                text: `Profil "${profile.name}" akan dihapus.`,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#dc2626',
                                cancelButtonColor: '#6b7280',
                                confirmButtonText: 'Ya, hapus',
                                cancelButtonText: 'Batal',
                              });
                              if (!result.isConfirmed) return;
                              await deletePricingProfile.mutateAsync(profile.id);
                              Swal.fire({
                                title: 'Berhasil dihapus',
                                icon: 'success',
                                timer: 1500,
                                showConfirmButton: false,
                              });
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {activeSection === 'receipt' && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
