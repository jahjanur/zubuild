#!/usr/bin/env node
/**
 * Translation key-parity check.
 *
 * en.json is the reference (default) locale. Every other locale file in
 * apps/web/src/i18n must contain every key present in en.json. Any locale
 * missing one or more keys fails the build (exit 1) so CI blocks the merge.
 *
 * Extra keys (present in a locale but not en.json) are reported as warnings
 * only — they do not fail the build.
 *
 * Usage: node scripts/check-i18n-parity.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, '..', 'apps', 'web', 'src', 'i18n');
const REFERENCE = 'en.json';

/** Flatten a nested object into dotted key paths (leaves only). */
function flatKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatKeys(v, path));
    else keys.push(path);
  }
  return keys;
}

const refPath = join(I18N_DIR, REFERENCE);
if (!existsSync(refPath)) {
  // Reference not present yet (e.g. translation files not merged) — nothing to
  // check against. Don't fail; the check activates once en.json lands.
  console.log(`ℹ️  i18n parity: reference ${REFERENCE} not found — skipping.`);
  process.exit(0);
}

const refKeys = flatKeys(JSON.parse(readFileSync(refPath, 'utf8')));
const refSet = new Set(refKeys);

const localeFiles = readdirSync(I18N_DIR)
  .filter((f) => f.endsWith('.json') && f !== REFERENCE)
  .sort();

let failed = false;
for (const file of localeFiles) {
  const keys = new Set(flatKeys(JSON.parse(readFileSync(join(I18N_DIR, file), 'utf8'))));
  const missing = refKeys.filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !refSet.has(k));

  if (missing.length) {
    failed = true;
    console.error(`\n❌ ${file}: missing ${missing.length} key(s) present in ${REFERENCE}:`);
    for (const k of missing) console.error(`     - ${k}`);
  }
  if (extra.length) {
    console.warn(`\n⚠️  ${file}: ${extra.length} extra key(s) not in ${REFERENCE} (not failing):`);
    for (const k of extra) console.warn(`     + ${k}`);
  }
  if (!missing.length) {
    console.log(`✅ ${file}: all ${refKeys.length} keys present`);
  }
}

if (failed) {
  console.error(`\n💥 i18n parity check FAILED — add the missing keys listed above.`);
  process.exit(1);
}
console.log(`\n✔ i18n parity check passed (${localeFiles.length} locale file(s) vs ${REFERENCE}, ${refKeys.length} keys).`);
