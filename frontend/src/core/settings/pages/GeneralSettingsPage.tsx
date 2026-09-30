import { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../../@shared/hooks/useTenant';
import { SETTINGS_SECTIONS } from '../sections/settingsSections';
import ProfileSection from '../sections/ProfileSection';
import TaxSection from '../sections/TaxSection';
import DiscountSection from '../sections/DiscountSection';
import TaxRulesSection from '../sections/TaxRulesSection';
import PricingProfilesSection from '../sections/PricingProfilesSection';
import RoundingSection from '../sections/RoundingSection';
import QrisSection from '../sections/QrisSection';
import ChargesSection from '../sections/ChargesSection';
import ReceiptSection from '../sections/ReceiptSection';
import SettingsTopBar from '../components/SettingsTopBar';
import SettingsSidebar from '../components/SettingsSidebar';
import { useSettingsDraft } from '../hooks/useSettingsDraft';
import { useSettingsSave } from '../hooks/useSettingsSave';
import { qrisConfigComplete } from '../utils/qris';

export default function GeneralSettingsPage() {
  const { data: tenant, isLoading } = useTenant();
  const { draft, saveInput, taxConfig, taxLoading, activeRules, activeCharges } = useSettingsDraft();

  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('profile');

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SETTINGS_SECTIONS;
    const q = search.toLowerCase();
    return SETTINGS_SECTIONS.filter(
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

  const { saving, saved, handleSave } = useSettingsSave(saveInput, activeRules);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      <SettingsTopBar
        search={search}
        onSearchChange={setSearch}
        onSave={handleSave}
        saving={saving}
        saved={saved}
      />

      <div className="flex-1 flex overflow-hidden">
        <SettingsSidebar sections={filteredSections} activeSection={activeSection} onSelect={setActiveSection} />

        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-3xl mx-auto p-6 space-y-8 pb-12">
            {activeSection === 'profile' && <ProfileSection tenant={tenant} {...draft.profile} />}

            {activeSection === 'tax' && <TaxSection {...draft.tax} />}

            {activeSection === 'discount' && <DiscountSection {...draft.discount} />}

            {activeSection === 'tax-rules' && (
              <TaxRulesSection taxConfig={taxConfig} taxLoading={taxLoading} activeRules={activeRules} />
            )}

            {activeSection === 'pricing-profiles' && <PricingProfilesSection activeRules={activeRules} />}

            {activeSection === 'rounding' && <RoundingSection {...draft.rounding} />}

            {activeSection === 'qris' && (
              <QrisSection {...draft.qris} qrisComplete={qrisConfigComplete(draft.qris)} />
            )}

            {activeSection === 'charges' && (
              <ChargesSection taxLoading={taxLoading} activeCharges={activeCharges} />
            )}

            {activeSection === 'receipt' && <ReceiptSection {...draft.receipt} />}
          </div>
        </div>
      </div>
    </div>
  );
}
