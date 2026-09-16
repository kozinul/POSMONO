function wrapLine(text: string, width: number): string[] {
  if (width <= 0 || text.length === 0) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    // word itself wider than the line: hard-slice
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function justifyColumns(left: string, right: string, maxChars: number): string[] {
  const leftLines = wrapLine(left, maxChars);
  const rightLines = wrapLine(right, maxChars - 1);
  const maxLines = Math.max(leftLines.length, rightLines.length, 1);
  const out: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const l = (leftLines[i] ?? '').trimEnd();
    const r = rightLines[i] ?? '';
    const rKeep = Math.min(r.length, Math.max(0, maxChars - 1), Math.max(0, maxChars - l.length));
    const lText = l.length + rKeep > maxChars ? l.slice(0, Math.max(0, maxChars - rKeep)) : l;
    const gap = rKeep > 0 ? Math.max(1, maxChars - lText.length - rKeep) : 0;
    out.push((lText + ' '.repeat(gap) + r.slice(0, rKeep)).slice(0, maxChars));
  }

  return out;
}