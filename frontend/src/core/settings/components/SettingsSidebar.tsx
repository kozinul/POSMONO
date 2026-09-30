import type { SettingsSectionMeta } from '../sections/settingsSections';

export interface SettingsSidebarProps {
  sections: SettingsSectionMeta[];
  activeSection: string;
  onSelect: (id: string) => void;
}

export default function SettingsSidebar({ sections, activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto py-4">
      {sections.length === 0 ? (
        <p className="px-4 text-sm text-gray-400">Tidak ada pengaturan</p>
      ) : (
        <ul className="space-y-0.5 px-2">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => onSelect(section.id)}
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
  );
}
