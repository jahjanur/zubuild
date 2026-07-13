/**
 * Ensures the bundled DejaVu Sans TTF fonts used for PDF generation are present
 * at the runtime path the PDF code reads: apps/api/assets/fonts/.
 *
 * These fonts give the order PDF full Unicode coverage — Cyrillic (Macedonian),
 * Latin-Extended (Albanian ë/ç, Turkish ş/ı/ğ). They are committed to the repo,
 * so this script is normally a no-op; run it to restore them if they go missing.
 *
 * Source order: (1) the installed `dejavu-fonts-ttf` npm package (offline,
 * deterministic), then (2) a network download as a last resort.
 *
 * Run: npm run fonts   (from apps/api)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONTS = [
  {
    file: 'DejaVuSans.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/dejavusans/DejaVuSans.ttf',
      'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf',
    ],
  },
  {
    file: 'DejaVuSans-Bold.ttf',
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/dejavusans/DejaVuSans-Bold.ttf',
      'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Bold.ttf',
    ],
  },
];

/** Resolve a font from the installed dejavu-fonts-ttf package, if available. */
function resolveFromPackage(file) {
  try {
    return require.resolve(`dejavu-fonts-ttf/ttf/${file}`);
  } catch {
    return null;
  }
}

function download(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Node font download)' } };
    https
      .get(url, opts, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return download(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  let failures = 0;
  for (const { file, urls } of FONTS) {
    const outPath = path.join(FONTS_DIR, file);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      console.log(`Font present: ${file}`);
      continue;
    }

    // 1) Copy from the installed npm package (offline, deterministic).
    const pkgPath = resolveFromPackage(file);
    if (pkgPath && fs.existsSync(pkgPath)) {
      fs.copyFileSync(pkgPath, outPath);
      console.log(`Copied ${file} from dejavu-fonts-ttf package`);
      continue;
    }

    // 2) Network download as a last resort.
    let ok = false;
    for (const url of urls) {
      console.log(`Downloading ${file}...`);
      try {
        const buf = await download(url);
        if (buf && buf.length > 1000) {
          fs.writeFileSync(outPath, buf);
          console.log(`Wrote ${file}`);
          ok = true;
          break;
        }
      } catch (e) {
        console.warn(`  Failed: ${e.message}`);
      }
    }
    if (!ok) {
      failures += 1;
      console.error(
        `Could not obtain ${file}. Install deps (npm install) so dejavu-fonts-ttf is available, ` +
          `or add ${file} to apps/api/assets/fonts/ manually (https://dejavu-fonts.github.io/Download.html).`
      );
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log('DejaVu fonts ready at apps/api/assets/fonts/');
  }
}

main();
