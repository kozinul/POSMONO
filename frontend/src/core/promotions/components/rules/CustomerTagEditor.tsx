import { useState } from 'react';
import { X } from 'lucide-react';
import type { RuleEditorProps } from './MinPurchaseEditor';

export default function CustomerTagEditor({ params, onChange }: RuleEditorProps) {
  const [input, setInput] = useState('');
  const tags = (params.tags as string[]) ?? [];

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange({ ...params, tags: [...tags, trimmed] });
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange({ ...params, tags: tags.filter((t) => t !== tag) });
  };

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Tag Customer</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="Ketik tag, Enter"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
        <button type="button" onClick={addTag} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Tambah</button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
