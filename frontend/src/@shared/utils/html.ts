const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes untrusted values before they are interpolated into an HTML string.
 *
 * Receipt/shift data comes from tenant-configured and user-entered text (store name,
 * product names, notes, cash pickup reasons, ...) and is rendered through
 * `dangerouslySetInnerHTML` / `document.write` sinks, so it must never be treated
 * as markup.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Returns an image source that cannot execute script, or `null` to fall back to a
 * placeholder. Allows remote http(s), safe inline `data:image` (script-capable SVG
 * is excluded), and scheme-less relative/absolute paths.
 */
export function safeImageSrc(value: unknown): string | null {
  const src = String(value ?? '').trim();
  if (!src) return null;
  if (/^(?:javascript|vbscript|file):/i.test(src)) return null;
  if (/^data:/i.test(src) && !/^data:image\/(?:png|jpe?g|gif|webp|bmp|x-icon);/i.test(src)) {
    return null;
  }
  return src;
}
