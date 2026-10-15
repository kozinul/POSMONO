import { describe, it, expect } from 'vitest';
import { renderLayoutToHtml } from '../../src/core/templates/utils/renderLayoutToHtml';
import { escapeHtml, safeImageSrc } from '../../src/@shared/utils/html';

describe('escapeHtml', () => {
  it('escapes every HTML-special character', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;',
    );
  });

  it('renders null/undefined as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('safeImageSrc', () => {
  it('allows http(s), safe data images, and relative paths', () => {
    expect(safeImageSrc('https://cdn.test/logo.png')).toBe('https://cdn.test/logo.png');
    expect(safeImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(safeImageSrc('/assets/logo.png')).toBe('/assets/logo.png');
  });

  it('rejects script-capable sources (DENY)', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeImageSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull();
    expect(safeImageSrc('')).toBeNull();
  });
});

describe('renderLayoutToHtml (receipt XSS guard)', () => {
  function layoutWith(nodes: unknown[]) {
    return { pages: [{ nodes }] };
  }

  it('escapes untrusted text content instead of executing it', () => {
    const html = renderLayoutToHtml(
      layoutWith([{ type: 'text', content: '<img src=x onerror="alert(1)">' }]),
    );

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('escapes column text while keeping line breaks', () => {
    const html = renderLayoutToHtml(
      layoutWith([
        {
          type: 'text',
          columns: [
            { text: '<b>Nama</b>' },
            { text: 'baris1\nbaris2', align: 'right' },
          ],
        },
      ]),
    );

    expect(html).toContain('&lt;b&gt;Nama&lt;/b&gt;');
    expect(html).toContain('baris1<br/>baris2');
    expect(html).not.toContain('<b>Nama</b>');
  });

  it('drops a javascript: logo source and shows the placeholder', () => {
    const html = renderLayoutToHtml(
      layoutWith([{ type: 'image', content: 'javascript:alert(1)' }]),
    );

    expect(html).not.toContain('javascript:');
    expect(html).toContain('(logo kosong)');
  });

  it('keeps a legitimate logo source', () => {
    const html = renderLayoutToHtml(
      layoutWith([{ type: 'image', content: 'https://cdn.test/logo.png' }]),
    );

    expect(html).toContain('https://cdn.test/logo.png');
    expect(html).not.toContain('(logo kosong)');
  });
});
