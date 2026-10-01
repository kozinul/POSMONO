#!/usr/bin/env node
// Budget kompleksitas — pagar angka anti-regresi (tech debt T9).
// Node murni, tanpa dependency. `node scripts/complexity-budget.mjs`.
//
// Batas = angka SESUDAH refactor T1–T6, bukan angka saat item pertama ditulis.
// Kalau sebuah aturan merah, naikkan batasnya dengan alasan tertulis di
// PR/commit yang sama — jangan diam-diam.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const LIMITS = {
  // God file yang sudah dipecah (T3–T6). Angka = hasil setelah refactor.
  'backend/src/bootstrap/container.ts': 200,
  'frontend/src/core/settings/pages/GeneralSettingsPage.tsx': 250,
  'frontend/src/core/platform/pages/TerminalCenterPage.tsx': 300,
  'frontend/src/core/reports/pages/ReportPage.tsx': 300,

  // Grandfathered backend domain services (holding limits to prevent growth — TECH_DEBT_PLAN.md § 6)
  'backend/src/core/payment/application/services/PaymentService.ts': 1200,
  'backend/src/core/reporting/application/services/ReportExportService.ts': 1200,
  'backend/src/core/reporting/infrastructure/aggregation/ReportAggregation.ts': 1300,

  // Batas umum untuk file source lain di mana pun (backend, frontend, shared).
  maxFileLines: 1000,
  // Constructor dengan >= 8 parameter positional harus 0 (T1+T2 named deps).
  maxCtorParams: 8,
  maxCtorCount: 0,
  // `: any` eksplisit di backend — baseline 289, turun ke <= 200 via T7.
  maxAnyBackend: 200,
};

const SOURCE_ROOTS = [
  'backend/src',
  'frontend/src',
  'shared/src',
  'scripts',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function readLines(file) {
  return readFileSync(file, 'utf8').split('\n');
}

const violations = [];
const report = (rule, detail) => violations.push({ rule, detail });

// --- 1. God file: batas per-file + batas global -----------------------------
const allFiles = SOURCE_ROOTS.flatMap((dir) => walk(join(root, dir)));
const lineCounts = new Map();
for (const file of allFiles) {
  const count = readLines(file).length - (readLines(file).at(-1) === '' ? 1 : 0);
  lineCounts.set(file, count);
}

for (const [relPath, limit] of Object.entries(LIMITS).filter(([k]) => k.includes('/'))) {
  const abs = join(root, relPath);
  if (!lineCounts.has(abs)) {
    report('god-file-missing', `${relPath} tidak ada — aturan tidak bisa diverifikasi`);
    continue;
  }
  const actual = lineCounts.get(abs);
  const status = actual <= limit ? 'ok' : 'FAIL';
  console.log(
    `${status === 'ok' ? '  ok  ' : ' FAIL '} ${relPath.padEnd(56)} ${String(actual).padStart(5)} / ${limit}`,
  );
  if (status === 'FAIL') report('god-file', `${relPath} ${actual} baris > batas ${limit}`);
}

const explicitFiles = new Set(
  Object.keys(LIMITS)
    .filter((k) => k.includes('/'))
    .map((p) => join(root, p)),
);

const oversized = [...lineCounts.entries()]
  .filter(([file, count]) => !explicitFiles.has(file) && count > LIMITS.maxFileLines)
  .map(([file, count]) => `${relative(root, file).split(sep).join('/')} (${count})`);
console.log(
  `${oversized.length === 0 ? '  ok  ' : ' FAIL '} file > ${LIMITS.maxFileLines} baris`.padEnd(64) +
    `${oversized.length} / ${LIMITS.maxFileLines}`,
);
if (oversized.length > 0) report('oversized-file', oversized.join(', '));

// --- 2. Constructor >= 8 parameter positional --------------------------------
// Hanya konstrutor dengan badan class (bukan deklarasi interface/abstract),
// karena deklarasi abstract method tidak punya daftar param runtime.
const CTOR = /^\s*(?:public\s+|private\s+|protected\s+|export\s+)*constructor\s*\(([^)]*)\)/gm;
const ctorHits = [];
for (const file of allFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(CTOR)) {
    const params = match[1]
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !/^[.)]/.test(p));
    if (params.length >= LIMITS.maxCtorParams) {
      const line = text.slice(0, match.index).split('\n').length;
      ctorHits.push(`${relative(root, file).split(sep).join('/')}:${line} (${params.length} param)`);
    }
  }
}
console.log(
  `${ctorHits.length === 0 ? '  ok  ' : ' FAIL '} constructor >= ${LIMITS.maxCtorParams} param positional`.padEnd(64) +
    `${ctorHits.length} / ${LIMITS.maxCtorCount}`,
);
for (const hit of ctorHits) console.log(`        ${hit}`);
if (ctorHits.length > 0) report('ctor-params', ctorHits.join(', '));

// --- 3. `: any` eksplisit di backend -----------------------------------------
const ANY = /:\s*any\b/g;
const anyHits = [];
for (const file of walk(join(root, 'backend/src'))) {
  const text = readFileSync(file, 'utf8');
  const count = (text.match(ANY) || []).length;
  if (count > 0) anyHits.push([relative(root, file).split(sep).join('/'), count]);
}
const anyTotal = anyHits.reduce((sum, [, count]) => sum + count, 0);
const anyStatus = anyTotal <= LIMITS.maxAnyBackend ? 'ok' : 'FAIL';
console.log(
  `${anyStatus === 'ok' ? '  ok  ' : ' FAIL '} ": any" di backend/src`.padEnd(64) +
    `${anyTotal} / ${LIMITS.maxAnyBackend}`,
);
if (anyStatus === 'FAIL') {
  const top = anyHits.sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [file, count] of top) console.log(`        ${file} (${count})`);
  report('any-backend', `total ${anyTotal} > batas ${LIMITS.maxAnyBackend}`);
}

// --- Hasil ------------------------------------------------------------------
console.log('');
if (violations.length === 0) {
  console.log(`Budget kompleksitas hijau (${allFiles.length} file dipindai).`);
  process.exit(0);
}
console.error(`Budget kompleksitas MERAH — ${violations.length} aturan dilanggar:`);
for (const v of violations) console.error(`  - [${v.rule}] ${v.detail}`);
process.exit(1);
