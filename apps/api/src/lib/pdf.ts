/**
 * Backend PDF generation for orders — professional, print-ready layout.
 * A4 portrait, 20–25mm margins. Helpers: drawHeader, drawMeta, drawItemsTable, drawTotals, drawNotes, drawFooter.
 * addPage() is only called when there is remaining table content that does not fit on the current page.
 */

import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { productLabel, normalizeLang, type CatalogLang } from './catalog-i18n';

// DejaVu Sans is a full-Unicode font (Cyrillic + Latin-Extended for Albanian ë/ç
// and Turkish ş/ı/ğ). It is BUNDLED in the repo so it is always present at
// runtime — no dependency on npm hoisting, the process cwd, or a network fetch.
// __dirname is apps/api/src/lib in dev (tsx) and apps/api/dist/lib in prod;
// both resolve up to apps/api/assets/fonts.
const FONT_DIR = path.resolve(__dirname, '../../assets/fonts');
const DEJAVU_REGULAR_PATH = path.join(FONT_DIR, 'DejaVuSans.ttf');
const DEJAVU_BOLD_PATH = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');
// Official AEM Residence logo (dark, for the white print header). Bundled SVG.
const AEM_LOGO_PATH = path.resolve(__dirname, '../../assets/aem-logo.svg');
let AEM_LOGO_SVG: string | null = null;
function aemLogoSvg(): string | null {
  if (AEM_LOGO_SVG === null) {
    try {
      AEM_LOGO_SVG = fs.readFileSync(AEM_LOGO_PATH, 'utf8');
    } catch {
      AEM_LOGO_SVG = '';
    }
  }
  return AEM_LOGO_SVG || null;
}
const AEM_LOGO_ASPECT = 860 / 280;

/**
 * Verify the bundled Unicode fonts exist. Call once at server startup so a
 * missing font fails LOUDLY here — rather than silently falling back to
 * Helvetica (Latin-only) and then throwing on the first Cyrillic label,
 * turning every PDF request into a 500.
 */
export function assertPdfFontsAvailable(): void {
  const missing = [DEJAVU_REGULAR_PATH, DEJAVU_BOLD_PATH].filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    throw new Error(
      `PDF fonts missing: ${missing.join(', ')}. ` +
        `Cyrillic/Albanian/Turkish text cannot be rendered without them. ` +
        `Restore the bundled DejaVu fonts with: npm run fonts (in apps/api).`
    );
  }
}

/** Order shape as returned by Prisma findUnique with include: { orderItems: true }. Dates may be Date or ISO string. */
type OrderWithItems = {
  orderNumber: string;
  orderDate: Date | string;
  supplierName: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  orderItems: Array<{ name: string; unit: string; price: number; quantity: number }>;
};

// A4: 595.28 x 841.89 pt. Margins 20mm ≈ 56.7 pt.
const MARGIN_PT = 57;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_PT;
const FOOTER_HEIGHT = 22;
const FOOTER_Y = PAGE_HEIGHT - MARGIN_PT - 12;
const BODY_TOP = 100; // after company header block
// Lowest Y any content block (table row, totals, notes) may occupy. Everything
// below belongs to the footer zone, so blocks page-break before crossing it —
// this is what keeps totals/notes from overlapping the footer.
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_PT - FOOTER_HEIGHT - 12;
const TOTALS_HEIGHT = 44; // subtotal + rule + total rows
// The items table also reserves room for the totals block, so totals sit directly
// under the last rows on the same page whenever they fit.
const TABLE_BOTTOM = CONTENT_BOTTOM - TOTALS_HEIGHT - 8;

// Letterhead — filled from the order's organization at generate time.
export type PdfCompany = {
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  regNo?: string | null;
  logoUrl?: string | null; // http(s) URL (app header) or data: URI (embedded in the PDF)
};
const DEFAULT_COMPANY: PdfCompany = { name: 'AEM Residence' };
let PDF_COMPANY: PdfCompany = DEFAULT_COMPANY;

const colors = {
  black: '#0a0a0a',
  darkGray: '#3d3d3d',
  gray: '#6b7280',
  gold: '#d4af37',
  text: '#1a1a1a',
  textMuted: '#4b5563',
  rowAlt: '#f9fafb',
  border: '#e5e7eb',
  headerBg: '#f3f4f6',
};

// Per-request currency + language, set at the top of generateOrderPdf. The
// draw phase is fully synchronous, so module-level state is safe across requests.
// PDF_LANG drives EVERY string on the page (labels, units, product names) plus
// number/date formatting, so the whole document reads in one language.
let PDF_CURRENCY = 'MKD';
let PDF_LOCALE = 'mk';
let PDF_LANG: CatalogLang = 'mk';

/** Money in the order's org currency + locale, no decimals (e.g. "120.000 ден.", "€1,234"). */
function formatMoney(n: number): string {
  try {
    return new Intl.NumberFormat(PDF_LOCALE, { style: 'currency', currency: PDF_CURRENCY, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n.toLocaleString(PDF_LOCALE)} ${PDF_CURRENCY}`;
  }
}

/** Order date in the org locale (e.g. "13 Jul 2026", "13.07.2026"). */
function formatPdfDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat(PDF_LOCALE, { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

type Doc = InstanceType<typeof PDFDocument>;

// Every text draw uses DejaVu (full Unicode). We NEVER fall back to Helvetica —
// its WinAnsi encoding can't represent Cyrillic and would throw at draw time.
const PDF_FONT = 'DejaVu';
const PDF_FONT_BOLD = 'DejaVuBold';

/** Invoice-style header: logo + company name left; company details (address, etc.) right. */
/** Embed a data:image logo (PNG/JPEG) if provided; returns whether it drew. */
function drawLogo(doc: Doc, logoUrl: string | null | undefined, x: number, y: number, w: number, h: number): boolean {
  if (!logoUrl || !logoUrl.startsWith('data:image/')) return false; // remote URLs render in the app header, not the PDF
  try {
    const base64 = logoUrl.slice(logoUrl.indexOf(',') + 1);
    const buf = Buffer.from(base64, 'base64');
    if (buf.length === 0) return false;
    doc.image(buf, x, y, { fit: [w, h] });
    return true;
  } catch {
    return false; // unsupported/corrupt image → fall back to the name
  }
}

function drawHeader(doc: Doc): void {
  const logoHeight = 44;
  const logoWidth = 88;
  const detailsWidth = 180;
  const detailsX = PAGE_WIDTH - MARGIN_PT - detailsWidth;
  const blockTop = 38;
  const nameY = blockTop + 14;

  // Left: the org's uploaded logo → the official AEM Residence logo → the name.
  if (!drawLogo(doc, PDF_COMPANY.logoUrl, MARGIN_PT, blockTop, logoWidth, logoHeight)) {
    const svg = aemLogoSvg();
    let drewLogo = false;
    if (svg) {
      try {
        const w = 150;
        SVGtoPDF(doc, svg, MARGIN_PT, blockTop + 4, { width: w, height: w / AEM_LOGO_ASPECT, preserveAspectRatio: 'xMinYMin meet' });
        drewLogo = true;
      } catch {
        drewLogo = false;
      }
    }
    if (!drewLogo) {
      doc.fillColor(colors.gold).fontSize(16).font(PDF_FONT_BOLD).text(PDF_COMPANY.name, MARGIN_PT, nameY);
    }
  }

  // Right: the org's letterhead details (only the ones that are set).
  doc.fillColor(colors.textMuted).fontSize(9).font(PDF_FONT);
  let lineY = blockTop;
  const lines = [PDF_COMPANY.address, PDF_COMPANY.email, PDF_COMPANY.phone, PDF_COMPANY.regNo].filter(
    (v): v is string => !!v && v.trim() !== ''
  );
  for (const line of lines) {
    doc.text(line, detailsX, lineY, { width: detailsWidth, align: 'right' });
    lineY += 12;
  }

  doc.moveTo(MARGIN_PT, 96).lineTo(PAGE_WIDTH - MARGIN_PT, 96).strokeColor(colors.border).stroke();
}

// PDF chrome in every supported language. The active set is chosen by PDF_LANG
// so labels match whatever language the order was exported in.
type PdfLabels = {
  orderDetails: string; orderNo: string; date: string; supplier: string; status: string;
  item: string; unit: string; price: string; qty: string; total: string; subtotal: string;
  notes: string; page: string; generated: string;
  statusPending: string; statusDelivered: string; statusReconciled: string;
};
const LABELS_BY_LANG: Record<CatalogLang, PdfLabels> = {
  mk: {
    orderDetails: 'Детали за нарачка', orderNo: 'Бр. нарачка', date: 'Датум', supplier: 'Добавувач', status: 'Статус',
    item: 'Ставка', unit: 'Ед.', price: 'Ед. цена', qty: 'Кол.', total: 'Вкупен износ', subtotal: 'Меѓузбир',
    notes: 'Забелешки', page: 'Страница', generated: 'Генерирано',
    statusPending: 'Чека', statusDelivered: 'Испорачано', statusReconciled: 'Ускладено',
  },
  en: {
    orderDetails: 'Order Details', orderNo: 'Order No.', date: 'Date', supplier: 'Supplier', status: 'Status',
    item: 'Item', unit: 'Unit', price: 'Unit Price', qty: 'Qty', total: 'Total', subtotal: 'Subtotal',
    notes: 'Notes', page: 'Page', generated: 'Generated',
    statusPending: 'Pending', statusDelivered: 'Delivered', statusReconciled: 'Reconciled',
  },
  sq: {
    orderDetails: 'Detajet e porosisë', orderNo: 'Nr. porosisë', date: 'Data', supplier: 'Furnitori', status: 'Statusi',
    item: 'Artikulli', unit: 'Njësia', price: 'Çmimi/njësi', qty: 'Sasia', total: 'Totali', subtotal: 'Nëntotali',
    notes: 'Shënime', page: 'Faqja', generated: 'Gjeneruar',
    statusPending: 'Në pritje', statusDelivered: 'Dorëzuar', statusReconciled: 'Rakorduar',
  },
  tr: {
    orderDetails: 'Sipariş Detayları', orderNo: 'Sipariş No', date: 'Tarih', supplier: 'Tedarikçi', status: 'Durum',
    item: 'Ürün', unit: 'Birim', price: 'Birim Fiyat', qty: 'Miktar', total: 'Toplam', subtotal: 'Ara Toplam',
    notes: 'Notlar', page: 'Sayfa', generated: 'Oluşturuldu',
    statusPending: 'Beklemede', statusDelivered: 'Teslim Edildi', statusReconciled: 'Mutabık',
  },
};
/** Active labels for the current export language. */
function L(): PdfLabels {
  return LABELS_BY_LANG[PDF_LANG] ?? LABELS_BY_LANG.mk;
}

// Measurement-unit codes → display per language. Mirrors the `units` namespace in
// apps/web/src/i18n/*.json so on-screen units and PDF units read identically.
const UNITS_BY_LANG: Record<CatalogLang, Record<string, string>> = {
  en: { kg: 'kg', ton: 'ton', litre: 'L', adet: 'pc', m: 'm', 'm²': 'm²', 'm³': 'm³', torba: 'bag', paket: 'pack', kutu: 'box', rulo: 'roll' },
  mk: { kg: 'кг', ton: 'тон', litre: 'л', adet: 'парче', m: 'м', 'm²': 'м²', 'm³': 'м³', torba: 'вреќа', paket: 'пакет', kutu: 'кутија', rulo: 'ролна' },
  sq: { kg: 'kg', ton: 'ton', litre: 'litër', adet: 'copë', m: 'm', 'm²': 'm²', 'm³': 'm³', torba: 'thes', paket: 'paketë', kutu: 'kuti', rulo: 'rrotull' },
  tr: { kg: 'kg', ton: 'ton', litre: 'litre', adet: 'adet', m: 'm', 'm²': 'm²', 'm³': 'm³', torba: 'torba', paket: 'paket', kutu: 'kutu', rulo: 'rulo' },
};

function unitLabelPdf(unit: string | null | undefined): string {
  if (!unit || !unit.trim()) return '';
  const key = unit.trim().toLowerCase();
  return (UNITS_BY_LANG[PDF_LANG] ?? UNITS_BY_LANG.mk)[key] ?? unit;
}

function orderStatusLabel(s: string | null | undefined): string {
  if (s === 'PENDING') return L().statusPending;
  if (s === 'DELIVERED') return L().statusDelivered;
  if (s === 'RECONCILED') return L().statusReconciled;
  return String(s ?? '');
}

/** Order details block — invoice-style: grey bar, two columns. */
function drawMeta(doc: Doc, order: OrderWithItems): number {
  const boxTop = BODY_TOP;
  const boxHeight = 52;
  doc.rect(MARGIN_PT, boxTop, CONTENT_WIDTH, boxHeight).fill(colors.headerBg).stroke(colors.border);
  doc.fillColor(colors.darkGray).fontSize(10).font(PDF_FONT_BOLD).text(L().orderDetails, MARGIN_PT + 10, boxTop + 10);
  doc.fillColor(colors.text).fontSize(9).font(PDF_FONT);
  const leftX = MARGIN_PT + 10;
  const rightX = MARGIN_PT + CONTENT_WIDTH * 0.55;
  const lineH = 14;
  const orderDateObj = order.orderDate instanceof Date ? order.orderDate : new Date(order.orderDate);
  const dateStr = formatPdfDate(orderDateObj);
  doc.text(`${L().orderNo}: ${String(order.orderNumber ?? '')}`, leftX, boxTop + 26);
  doc.text(`${L().date}: ${dateStr}`, leftX, boxTop + 26 + lineH);
  doc.text(`${L().supplier}: ${String(order.supplierName ?? '')}`, rightX, boxTop + 26);
  doc.text(`${L().status}: ${orderStatusLabel(order.status)}`, rightX, boxTop + 26 + lineH);
  return boxTop + boxHeight + 10;
}

// Full width table; column widths sum to CONTENT_WIDTH
const COL = {
  name: 200,
  unit: 52,
  price: 88,
  qty: 52,
  total: Math.floor(CONTENT_WIDTH - 200 - 52 - 88 - 52),
};
const ROW_HEIGHT = 20;
const HEADER_ROW_HEIGHT = 24;
const TABLE_WIDTH = CONTENT_WIDTH;

/** Trim text to a single line that fits maxWidth, appending an ellipsis. Uses
 *  the current font metrics (DejaVu @ 9pt), so it's correct for Cyrillic/Latin.
 *  Keeps rows a fixed height — long names never wrap into the next row. */
function ellipsize(doc: Doc, text: string, maxWidth: number): string {
  doc.font(PDF_FONT).fontSize(9);
  if (doc.widthOfString(text) <= maxWidth) return text;
  const ell = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.widthOfString(text.slice(0, mid) + ell) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + ell;
}

function drawTableHeaderRow(doc: Doc, x: number, y: number): void {
  doc.rect(x, y, TABLE_WIDTH, HEADER_ROW_HEIGHT).fill(colors.darkGray).stroke(colors.border);
  doc.fillColor('#fff').fontSize(9).font(PDF_FONT_BOLD);
  doc.text(L().item, x + 8, y + 6, { width: COL.name - 8 });
  doc.text(L().unit, x + COL.name, y + 6, { width: COL.unit, align: 'right' });
  doc.text(L().price, x + COL.name + COL.unit, y + 6, { width: COL.price, align: 'right' });
  doc.text(L().qty, x + COL.name + COL.unit + COL.price, y + 6, { width: COL.qty, align: 'right' });
  doc.text(L().total, x + COL.name + COL.unit + COL.price + COL.qty, y + 6, { width: COL.total - 4, align: 'right' });
}

/** Items table: full width, header repeats on new page, alternating rows, right-aligned numbers.
 * addPage() ONLY when we are about to draw a row and it would not fit on the current page (next row would overflow). */
function drawItemsTable(
  doc: Doc,
  order: OrderWithItems,
  startY: number
): { endY: number; pageCount: number } {
  const x = MARGIN_PT;
  let y = startY;
  let pageCount = 1; // we start on page 0 (first page)

  doc.fillColor(colors.text).font(PDF_FONT).fontSize(9);

  const items = order.orderItems ?? [];
  for (let i = 0; i < items.length; i++) {
    // Only add a new page when the NEXT row would overflow the table area (and we have a row to draw)
    const nextRowBottom = y + ROW_HEIGHT;
    const wouldOverflow = nextRowBottom > TABLE_BOTTOM;
    if (wouldOverflow) {
      doc.addPage({ size: 'A4', margin: MARGIN_PT });
      pageCount += 1;
      y = BODY_TOP;
      drawTableHeaderRow(doc, x, y);
      y += HEADER_ROW_HEIGHT;
    }

    const item = items[i];
    const price = Number(item.price);
    const qty = Number(item.quantity) || 0;
    const total = price * qty;
    const rowY = y;
    const fill = i % 2 === 1 ? colors.rowAlt : '#fff';
    doc.rect(x, rowY, TABLE_WIDTH, ROW_HEIGHT).fill(fill).stroke(colors.border);
    doc.fillColor(colors.text).font(PDF_FONT).fontSize(9);
    const nameLabel = productLabel(item.name, PDF_LANG);
    doc.text(ellipsize(doc, nameLabel, COL.name - 10), x + 8, rowY + 5, { width: COL.name - 10, lineBreak: false });
    doc.text(unitLabelPdf(item.unit), x + COL.name, rowY + 5, { width: COL.unit, align: 'right' });
    doc.text(formatMoney(price), x + COL.name + COL.unit, rowY + 5, { width: COL.price, align: 'right' });
    doc.text(String(qty), x + COL.name + COL.unit + COL.price, rowY + 5, { width: COL.qty, align: 'right' });
    doc.text(formatMoney(total), x + COL.name + COL.unit + COL.price + COL.qty, rowY + 5, { width: COL.total - 4, align: 'right' });
    y += ROW_HEIGHT;
  }

  return { endY: y, pageCount };
}

/** Totals block: invoice-style, right-aligned, MKD. */
function drawTotals(doc: Doc, totalAmount: number, startY: number): number {
  const boxWidth = 200;
  const numbersWidth = 95;
  const rightPadding = 10;
  const boxRight = PAGE_WIDTH - MARGIN_PT - rightPadding;
  const boxX = boxRight - boxWidth;
  const lineY = startY + 18;
  doc.fillColor(colors.text).fontSize(9).font(PDF_FONT);
  doc.text(L().subtotal, boxX + 8, startY + 4);
  doc.text(formatMoney(totalAmount), boxRight - 8 - numbersWidth, startY + 4, { width: numbersWidth, align: 'right' });
  doc.moveTo(boxX, lineY).lineTo(boxX + boxWidth, lineY).strokeColor(colors.border).stroke();
  doc.font(PDF_FONT_BOLD).fontSize(10);
  doc.text(L().total, boxX + 8, lineY + 6);
  doc.text(formatMoney(totalAmount), boxRight - 8 - numbersWidth, lineY + 6, { width: numbersWidth, align: 'right' });
  return lineY + 22;
}

const NOTES_PADDING = 10;
const NOTES_TEXT_TOP = 16; // where the note body starts inside the box
const NOTES_TEXT_WIDTH = CONTENT_WIDTH - 2 * NOTES_PADDING;
const NOTES_MIN_HEIGHT = 36;

/** Height the notes box needs for the wrapped text — so the box grows with the
 *  content instead of clipping at a fixed 36pt. */
function measureNotesHeight(doc: Doc, notes: string): number {
  doc.font(PDF_FONT).fontSize(9);
  const textH = doc.heightOfString(notes, { width: NOTES_TEXT_WIDTH });
  return Math.max(NOTES_MIN_HEIGHT, NOTES_TEXT_TOP + textH + NOTES_PADDING);
}

/** Notes section: only if notes exist; invoice-style bordered box sized to fit
 *  the (already measured) note text. */
function drawNotes(doc: Doc, notes: string | null, startY: number, boxHeight: number): number {
  if (!notes || !notes.trim()) return startY;
  doc.rect(MARGIN_PT, startY, CONTENT_WIDTH, boxHeight).fill(colors.rowAlt).stroke(colors.border);
  doc.fillColor(colors.textMuted).fontSize(8).font(PDF_FONT_BOLD).text(L().notes, MARGIN_PT + NOTES_PADDING, startY + 6);
  doc.fillColor(colors.text).font(PDF_FONT).fontSize(9).text(notes, MARGIN_PT + NOTES_PADDING, startY + NOTES_TEXT_TOP, { width: NOTES_TEXT_WIDTH });
  return startY + boxHeight + 10;
}

/** Draw footer on the current page only. Use width large enough so page number never wraps (avoids stray "1" on next page). */
function drawFooter(doc: Doc, pageNum: number, totalPages: number): void {
  const y = FOOTER_Y;
  const generated = new Date();
  const d = generated.getDate(); const m = generated.getMonth() + 1; const yr = generated.getFullYear();
  const h = generated.getHours(); const min = generated.getMinutes();
  const generatedStr = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${yr} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  doc.fillColor(colors.textMuted).fontSize(7).font(PDF_FONT);
  doc.text([PDF_COMPANY.name, PDF_COMPANY.regNo].filter(Boolean).join(' | '), MARGIN_PT, y - 8);
  doc.text(`${L().generated}: ${generatedStr}`, MARGIN_PT, y);
  // Width 90 so "Страница 1 / 1" or "Страница 12 / 12" fits on one line and never wraps to a new page
  doc.text(`${L().page} ${pageNum} / ${totalPages}`, PAGE_WIDTH - MARGIN_PT - 90, y, { width: 90, align: 'right' });
}

export function generateOrderPdf(
  order: OrderWithItems,
  opts: { currency?: string; locale?: string; lang?: string; company?: PdfCompany } = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Guard: never draw non-Latin text with a Latin-only font. If the bundled
      // Unicode fonts are absent, fail here instead of emitting a broken/500 PDF.
      assertPdfFontsAvailable();

      // The export language (from the request) drives all chrome, units, product
      // names, and number/date formatting so the whole PDF is in one language.
      // Currency stays the org's; only its formatting locale follows the language.
      PDF_CURRENCY = opts.currency || 'MKD';
      PDF_LANG = normalizeLang(opts.lang || opts.locale || 'mk');
      PDF_LOCALE = opts.lang || opts.locale || 'mk';
      PDF_COMPANY = opts.company && opts.company.name ? opts.company : DEFAULT_COMPANY;

      const doc = new PDFDocument({ margin: MARGIN_PT, size: 'A4', bufferPages: true }) as Doc;
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register the bundled DejaVu faces and use them for every text draw.
      doc.registerFont(PDF_FONT, DEJAVU_REGULAR_PATH);
      doc.registerFont(PDF_FONT_BOLD, DEJAVU_BOLD_PATH);
      doc.font(PDF_FONT);

      drawHeader(doc);
      let y = drawMeta(doc, order);

      drawTableHeaderRow(doc, MARGIN_PT, y);
      y += HEADER_ROW_HEIGHT;

      const table = drawItemsTable(doc, order, y);
      let pageCount = table.pageCount;
      y = table.endY + 8;

      // Start a fresh page when the next block would cross into the footer zone.
      const breakForBlock = (blockHeight: number): void => {
        if (y + blockHeight > CONTENT_BOTTOM) {
          doc.addPage({ size: 'A4', margin: MARGIN_PT });
          pageCount += 1;
          y = BODY_TOP;
        }
      };

      breakForBlock(TOTALS_HEIGHT);
      y = drawTotals(doc, Number(order.totalAmount), y);

      const notes = order.notes ?? null;
      if (notes && notes.trim()) {
        const notesHeight = measureNotesHeight(doc, notes);
        breakForBlock(notesHeight + 10);
        y = drawNotes(doc, notes, y, notesHeight);
      }

      // Draw footer ONLY on pages that have content (use our pageCount, not bufferedPageRange, to avoid drawing on any stray blank page)
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        drawFooter(doc, i + 1, pageCount);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
