export function renderLayoutToHtml(layout: any): string {
  if (!layout?.pages?.[0]) return '<p>No preview layout</p>';
  const page = layout.pages[0];
  const nodes = page.nodes ?? [];
  if (nodes.length === 0) return '<p class="text-gray-400">Template kosong — tambahkan section/komponen untuk melihat preview.</p>';
  return nodes.map((c: any) => {
    const font = c.style?.font ?? {};
    if (c.type === 'spacer') {
      return `<div style="height:${font.size ?? c.height ?? 4}px;"></div>`;
    }
    if (c.type === 'divider') {
      return `<div style="border-top:1px dashed #999;margin:4px 0;width:100%;"></div>`;
    }
    if (c.type === 'image') {
      const src = c.content || '';
      return `<div style="display:flex;justify-content:center;align-items:center;padding:4px 0;width:100%;">
        ${src ? `<img src="${src}" style="max-width:180px;max-height:70px;object-fit:contain;" />` : '<span style="color:#bbb;">(logo kosong)</span>'}
      </div>`;
    }
    if (c.columns?.length) {
      const toHtml = (t: string) => String(t ?? '').replace(/\n/g, '<br/>');
      return `
        <div style="display:flex;justify-content:space-between;font-size:${font.size ?? 12}px;font-weight:${font.weight ?? 'normal'};color:${font.color ?? '#000'};">
          ${c.columns.map((col: any) =>
            `<span style="text-align:${col.align === 'right' ? 'right' : 'left'};white-space:pre-wrap;">${toHtml(col.text)}</span>`
          ).join('')}
        </div>
      `;
    }
    const content = String(c.content ?? '').replace(/\n/g, '<br/>');
    return `
      <div style="text-align:${font.align ?? 'left'};font-size:${font.size ?? 12}px;font-weight:${font.weight ?? 'normal'};color:${font.color ?? '#000'};">
        ${content}
      </div>
    `;
  }).join('');
}
