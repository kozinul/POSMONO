export type FormatterFn = (value: unknown, ...args: string[]) => string;

export class FormatterRegistry {
  private formatters = new Map<string, FormatterFn>();

  register(name: string, fn: FormatterFn): void {
    this.formatters.set(name, fn);
  }

  get(name: string): FormatterFn | undefined {
    return this.formatters.get(name);
  }

  getAll(): { name: string; fn: FormatterFn }[] {
    return Array.from(this.formatters.entries()).map(([name, fn]) => ({ name, fn }));
  }

  clear(): void {
    this.formatters.clear();
  }
}

export const defaultFormatters: Record<string, FormatterFn> = {
  currency: (value, locale = 'id-ID', currency = 'IDR') => {
    const n = Number(value);
    if (isNaN(n)) return String(value ?? '');
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
    } catch {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);
    }
  },

  number: (value, decimals = '0') => {
    const n = Number(value);
    if (isNaN(n)) return String(value ?? '');
    return n.toFixed(parseInt(decimals, 10) || 0);
  },

  date: (value, format = 'short') => {
    if (!value) return '';
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    if (format === 'short') {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (format === 'long') {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (format === 'datetime') {
      return d.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
    if (format === 'time') {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  uppercase: (value) => String(value ?? '').toUpperCase(),
  lowercase: (value) => String(value ?? '').toLowerCase(),
  capitalize: (value) => {
    const s = String(value ?? '');
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  },
};

export function parsePipeFormat(format: string): { name: string; args: string[] }[] {
  if (!format) return [];
  return format.split('|').map((part) => {
    const trimmed = part.trim();
    const match = trimmed.match(/^(\w+)(?:\((.*?)\))?$/);
    if (!match) return { name: trimmed, args: [] };
    const args = match[2] ? match[2].split(',').map((a) => a.trim().replace(/^['"]|['"]$/g, '')) : [];
    return { name: match[1], args };
  });
}

export function applyFormat(
  value: unknown,
  format: string | undefined,
  registry: FormatterRegistry,
): string {
  if (!format) return String(value ?? '');
  const pipes = parsePipeFormat(format);
  let result = String(value ?? '');
  for (const pipe of pipes) {
    const fn = registry.get(pipe.name);
    if (fn) {
      result = fn(result, ...pipe.args);
    }
  }
  return result;
}
