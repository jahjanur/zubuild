# Zubuild — Team Delivery Plan (detailed, one task per block)

**What Zubuild is:** a modern, multi-tenant SaaS for construction companies to run materials procurement and delivery control — manage suppliers & products, issue professional PDF purchase orders, reconcile *ordered vs delivered* to flag missing quantities and monetary loss (anti-theft), and see it all in analytics. Multi-language (English / Macedonian / Albanian), mobile + desktop.

**Repo:** https://github.com/jahjanur/zubuild.git
**Base app:** React + Vite + TS + Tailwind (`apps/web`), Node/Express + Prisma/SQLite (`apps/api`), shared Zod types (`packages/shared`) — npm workspaces monorepo. The UI is **already wired for i18n** (every page uses `t('key')`); it just ships one Turkish file today.

**How to use this doc:** each block below is a standalone ticket. Format = `Priority · Effort · file(s)` → steps/spec → **Done when** (acceptance). Priorities: `P0` must-have · `P1` important · `P2` later. Effort: `S` <½ day · `M` 1–3 days · `L` 1–2 weeks. Order = recommended execution sequence.

---

## Design language: "Grey Glass" (reference for all UI tasks)

Monochrome glassmorphism. Surfaces are frosted translucent white over a soft grey gradient; the only "accent" is **black** (solid pill buttons / active nav, like the SugarCRM reference). No color accents.

| Hex | Name | Role |
|---|---|---|
| `#EBEDF1` | Bright Grey | App background (lightest) |
| `#D4D8DF` | Shy Blunt | Secondary surface, light borders, solid fallback |
| `#ACADB1` | Grey Timber Wolf | Borders, muted/disabled text |
| `#706F70` | Smoked Pearl | Secondary text |
| `#353536` | Jet Black | Primary text, dark surfaces, button hover |
| `#080808` | Reversed Grey | Max-contrast text, black accent / active pills |

---

## TODO 1 — Clone & run Zubuild locally
`P0 · S · repo root`
Steps: clone the repo → `npm install` → `npm run build -w @aem/shared` (API depends on it) → `cp apps/api/.env.example apps/api/.env` → `npm run db:migrate` → `npm run db:seed` → `npm run dev`. Web = http://localhost:5173, API = http://localhost:4000. Login `admin@aem-residence.com` / `admin` (also `admin2@…`/`admin2`, `viewer@…`/`viewer`).
**Done when:** app loads, login works, dashboard shows seeded data.

## TODO 2 — Fix the seed-password doc mismatch
`P0 · S · README.md, RUN.md, apps/api/prisma/seed.ts`
Docs claim the password is `changeMeNow!` but `seed.ts` sets `admin`. Make docs and seed agree (recommend documenting `admin` for dev; use a strong seeded password only for prod seeds).
**Done when:** the documented login works on a fresh clone.

## TODO 3 — Auto-build the shared package on install/dev
`P0 · S · package.json (root)`
A fresh clone crashes on `npm run dev` with `Cannot find module '@aem/shared/dist/index.js'` until shared is built. Add `"postinstall": "npm run build -w @aem/shared"` (or a `predev` step).
**Done when:** a brand-new clone runs with the documented commands, no manual build.

## TODO 4 — Set up CI
`P1 · M · repo`
Pipeline runs on every PR: install → build shared → typecheck (`tsc`) → lint → `npm run test` → build web+api.
**Done when:** PRs are auto-checked and go red on failure.

## TODO 5 — Branch protection & PR conventions
`P1 · S · repo settings`
Protect `main`; require review + passing CI; agree branch naming + commit style.
**Done when:** no direct pushes to `main`.

---

## TODO 6 — Add the "Grey Glass" design tokens
`P1 · S · apps/web/src/styles/theme.css`
Replace the current black/gold `:root` variables with the exact set below. (This file drives the whole app via semantic tokens.)
```css
:root {
  /* Background: soft grey gradient so glass blur has something to refract */
  --app-bg: #EBEDF1;
  --app-bg-gradient: linear-gradient(135deg, #EBEDF1 0%, #D4D8DF 100%);
  --surface-1: #D4D8DF;         /* solid fallback when no backdrop-filter */
  --surface-2: #EBEDF1;

  /* Glass */
  --glass-bg: rgba(255,255,255,0.55);
  --glass-bg-strong: rgba(255,255,255,0.72);
  --glass-border: rgba(255,255,255,0.60);
  --glass-blur: blur(20px) saturate(140%);

  /* Borders / focus */
  --border: rgba(172,173,177,0.40);   /* Grey Timber Wolf @40% */
  --border-focus: rgba(8,8,8,0.55);

  /* Text */
  --text-primary: #080808;
  --text-secondary: #706F70;
  --text-muted: #ACADB1;

  /* Accent = black */
  --accent: #080808;
  --accent-hover: #353536;
  --accent-contrast: #FFFFFF;

  /* Semantic (kept subtle) */
  --danger: #B42318; --danger-muted: rgba(180,35,24,0.10);
  --success: #067647; --success-muted: rgba(6,118,71,0.10);
  --warning: #B54708; --warning-muted: rgba(181,71,8,0.10);

  --overlay: rgba(53,53,54,0.35);
  --shadow-card: 0 8px 32px rgba(8,8,8,0.08);
  --shadow-modal: 0 24px 60px -12px rgba(8,8,8,0.28);
  --shadow-button: 0 1px 2px rgba(8,8,8,0.10);
}
```
**Done when:** the variables exist and the app compiles (visuals fixed in TODO 8).

## TODO 7 — Update the Tailwind color config to match tokens
`P1 · S · apps/web/tailwind.config.js`
Mirror TODO 6 as literal values under `theme.extend.colors.app` (Tailwind needs literals, not `var()`), and rename the misleading `gold*` tokens to `accent`/`accent-hover`/`accent-muted`. Set `boxShadow.card/modal/button` to the soft values from TODO 6. Remove the `luxury` color group.
```js
app: {
  bg:'#EBEDF1', 'surface-1':'#D4D8DF', 'surface-2':'#EBEDF1',
  border:'rgba(172,173,177,0.40)', 'border-focus':'rgba(8,8,8,0.55)',
  primary:'#080808', secondary:'#706F70', muted:'#ACADB1',
  accent:'#080808', 'accent-hover':'#353536', 'accent-muted':'rgba(8,8,8,0.06)',
  danger:'#B42318', success:'#067647', warning:'#B54708',
  overlay:'rgba(53,53,54,0.35)',
}
```
Then find/replace `app-gold` → `app-accent` across `apps/web/src`.
**Done when:** `bg-app-bg`, `text-app-primary`, `text-app-accent`, `border-[var(--border)]` all resolve to the new greys; no `app-gold` references remain.

## TODO 8 — Global theme conversion + dark-mode cleanup
`P1 · M · apps/web/src (global)`
After 6–7 most of the app re-skins. Then fix hard-coded dark-mode assumptions. Exact conversions:
- `hover:bg-white/10` → `hover:bg-slate-900/[0.06]` (all files)
- `hover:bg-white/5` and `hover:bg-white/[0.04]` → `hover:bg-slate-900/[0.04]`
- `bg-white/10` (Badge default) → `bg-slate-900/[0.06]`
- `border-white/15` → `border-slate-900/10`; `border-white/20` → `border-slate-900/15`
- `hover:border-white/[0.12]` (Card) → `hover:border-slate-900/[0.10]`
- `apps/web/src/index.css` focus ring: change `box-shadow: 0 0 0 2px #0B0F14, 0 0 0 4px rgba(212,175,55,0.5)` → `0 0 0 2px #FFFFFF, 0 0 0 4px rgba(8,8,8,0.45)`
- `apps/web/src/index.css` date picker: remove `filter: invert(1)` (dark-only), set `opacity: 0.7`
- `apps/web/src/App.tsx` loading screen: `bg-luxury-black`/`text-luxury-gold` (undefined) → `bg-app-bg`/`text-app-accent`
- `apps/web/src/index.css` `body`: set `background: var(--app-bg-gradient); background-attachment: fixed;`
**Done when:** every screen (dashboard, orders, products, suppliers, create order, reconciliation, control panel, analytics, login, modals, dropdowns, toasts) is legible in grey-glass with AA contrast and no leftover dark styling.

## TODO 9 — Add the reusable `.glass` surface utility
`P1 · S · apps/web/src/index.css`
Add a utility used by cards, nav, modals, dropdowns, sticky bars:
```css
.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-card);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: var(--surface-1); }   /* solid fallback */
}
```
**Done when:** applying `.glass` yields the frosted look and degrades to a solid grey surface where blur isn't supported.

## TODO 10 — Redesign the Button component (glass + black pills)
`P1 · S · apps/web/src/components/ui/Button.tsx`
Spec:
- `primary`: `bg-app-accent text-white rounded-full hover:bg-app-accent-hover shadow-button` — solid black pill (matches reference active tabs).
- `secondary`: `.glass text-app-primary rounded-full hover:bg-white/70` (glass pill).
- `ghost`: transparent, `text-app-primary`, `border border-[var(--border)]`, `rounded-full`, `hover:bg-slate-900/[0.04]`.
- `danger`: `bg-[var(--danger-muted)] text-[var(--danger)] border border-[var(--danger)]/30 rounded-full`.
- Keep 44px min height, focus-visible ring uses `--border-focus`.
**Done when:** buttons are pill-shaped, primary is solid black with white text, secondary/ghost are glass, all states (hover/focus/disabled) look intentional.

## TODO 11 — Redesign Card → glass
`P1 · S · apps/web/src/components/ui/Card.tsx`
Change the base to `.glass rounded-2xl` (16px radius), section padding unchanged; `CardHeader` divider uses `border-[var(--border)]`; hover lifts subtly (`hover:shadow-modal` optional). Remove the old `bg-app-surface-1 border ... hover:border-white/[0.12]`.
**Done when:** every card renders as a frosted glass panel with rounded corners and a soft shadow.

## TODO 12 — Redesign Modal & overlay → glass
`P1 · S · apps/web/src/components/ui/Modal.tsx`
Overlay uses `bg-[var(--overlay)] backdrop-blur-sm`; the dialog uses `.glass rounded-2xl` with `--glass-bg-strong` (more opaque for readability); header/footer bars translucent with `border-[var(--border)]`; close button `hover:bg-slate-900/[0.06]`.
**Done when:** modals float as a strong-glass panel over a blurred scrim, readable on any background.

## TODO 13 — Redesign inputs (Input, Textarea, Select)
`P1 · S · apps/web/src/components/ui/{Input,Textarea,Select}.tsx`
Fields: `bg-white/60` (glassy) `border border-[var(--border)] rounded-xl text-app-primary placeholder-app-muted`, focus `border-[var(--border-focus)] ring-2 ring-black/10`. Select trigger + dropdown list use `.glass`; the chevron/check use `text-app-secondary`/`text-app-accent`. Keep 44–48px min height.
**Done when:** all form controls share one glassy style with a black-tinted focus ring; dropdown menus are glass.

## TODO 14 — Redesign Table
`P1 · S · apps/web/src/components/ui/Table.tsx`
Wrapper `rounded-xl border-[var(--border)]` on a glass card; header row `bg-white/50 text-app-primary`; body rows `hover:bg-slate-900/[0.04]`, dividers `border-[var(--border)]`; action icon buttons `hover:bg-slate-900/[0.06]`.
**Done when:** tables read clearly on glass with a distinguishable header and subtle row hover.

## TODO 15 — Redesign Badge & StatCard
`P1 · S · apps/web/src/components/ui/{Badge,StatCard}.tsx`
Badge default `bg-slate-900/[0.06] text-app-secondary border-[var(--border)] rounded-full`; success/warning/danger use the muted semantic tokens. StatCard: big value `text-app-primary` (or `text-app-accent` when `accent`), label `text-app-secondary`, sits on a glass Card.
**Done when:** badges are subtle grey pills; stat cards read as glass tiles.

## TODO 16 — Redesign navigation (sidebar + mobile drawer + bottom bar)
`P1 · M · apps/web/src/layout/AppLayout.tsx`
Sidebar/drawer are `.glass`. Nav links: inactive `text-app-secondary hover:bg-slate-900/[0.04] rounded-full`; **active = solid black pill** `bg-app-accent text-white rounded-full` (matches reference). Logout = ghost/danger pill. Mobile top bar and any sticky summary bar also use `.glass`. Replace all `bg-app-gold-muted/border-app-gold` active states.
**Done when:** active nav is a black pill on a glass sidebar; mobile drawer/top bar are glass; no gold remains.

## TODO 17 — Redesign the Login screen
`P1 · S · apps/web/src/pages/Login.tsx`
Full-screen `--app-bg-gradient`; centered `.glass rounded-2xl` card; title `text-app-primary` = "Zubuild"; primary button is the black pill; add the language switcher here (see TODO 20). Update the email placeholder away from the AEM address if desired.
**Done when:** login is a single glass card centered on the grey gradient, on brand.

## TODO 18 — Rebrand visuals to Zubuild
`P1 · S · apps/web/src/assets/, apps/web/public/favicon.svg, apps/web/index.html`
Replace the AEM logo + favicon with Zubuild assets; set `<title>Zubuild</title>`; update product-name strings (mostly `login.title` in the locale files). Update logo `alt` text in `AppLayout.tsx`.
**Done when:** no "AEM Residence" branding remains in the product chrome.

## TODO 19 — Rename the npm workspace scope to @zubuild
`P2 · S · all package.json + imports`
Find/replace `@aem/` → `@zubuild/` across every `package.json` and import, plus root `name` → `zubuild`; then `npm install` to relink the workspace and rebuild shared.
**Done when:** the app builds and runs under the `@zubuild/*` scope.

## TODO 20 — Design/system QA of the redesign
`P2 · M · apps/web/src`
Audit radius (pills for buttons/nav, `rounded-2xl` cards), spacing, glass consistency, and hover/focus/disabled states across every screen and primitive. Verify the glass fallback (`@supports not`) on a browser without `backdrop-filter`. Check AA contrast of text over translucent surfaces.
**Done when:** the app reads as one cohesive modern glass system and passes an a11y/contrast check.

## TODO 21 — Responsive & mobile QA of the theme
`P2 · S · apps/web/src`
Verify sidebar, mobile bottom/summary bars, sticky order summary, and modals on phone/tablet/desktop with glass surfaces.
**Done when:** no clipped/broken layouts on any breakpoint.

---

## TODO 22 — Create the English translation file (default)
`P0 · M · apps/web/src/i18n/en.json`
Mirror the ~235 keys in `apps/web/src/i18n/tr.json` exactly (same nested structure); translate values to English; set `login.title` to "Zubuild".
**Done when:** `en.json` has identical keys to `tr.json`.

## TODO 23 — Create the Macedonian translation file
`P0 · M · apps/web/src/i18n/mk.json`
Same keys, Macedonian (Cyrillic) values; native review of construction terms (unit, reconciliation, supplier, loss, order).
**Done when:** `mk.json` complete and reviewed.

## TODO 24 — Create the Albanian translation file
`P0 · M · apps/web/src/i18n/sq.json`
Same keys, Albanian values; native review of construction terms.
**Done when:** `sq.json` complete and reviewed.

## TODO 25 — Rewire i18n init (EN default + persistence)
`P0 · S · apps/web/src/i18n/index.ts`
Load en/mk/sq; `fallbackLng:'en'`, default `lng:'en'`; persist the selected language to `localStorage` and restore on load (optionally add `i18next-browser-languagedetector`).
**Done when:** language choice survives a refresh.

## TODO 26 — Add a language switcher
`P0 · S · apps/web/src/layout/AppLayout.tsx, apps/web/src/pages/Login.tsx`
Add a switcher (labels: English / Македонски / Shqip) to the desktop sidebar footer, the mobile drawer, and the login page. Style as glass pills.
**Done when:** every screen re-renders in the chosen language instantly.

## TODO 27 — Locale-aware number/date/currency formatting
`P1 · M · apps/web/src/lib/formatMKD.ts`
Replace the fixed `tr-TR` locale with `Intl.NumberFormat`/`Intl.DateTimeFormat` driven by the active language. (Currency itself becomes per-tenant in TODO 42.)
**Done when:** numbers/dates render correctly per language, no hard-coded `tr-TR`.

## TODO 28 — Add a translation key-parity check in CI
`P1 · S · script + CI`
Script that fails the build if any locale file is missing keys present in `en.json`.
**Done when:** missing translations break CI.

## TODO 29 — Cross-language overflow QA
`P1 · S · apps/web/src`
Verify longer strings don't clip nav, buttons, table headers, or modal titles in EN/MK/SQ.
**Done when:** no truncated/broken labels in any language.

---

## TODO 30 — Redesign Create Order item picker (browse-first, glass)
`P1 · M · apps/web/src/pages/CreateOrder.tsx`
Replace the "type ≥2 chars to add a product" flow. New UX: show all ACTIVE products as tappable glass cards/rows (name + unit + price), tap to add to the order; keep search as an optional filter (not required). Use existing `GET /products` and `/products/search`. Selected items list uses steppers (TODO 32).
**Done when:** a user can build a multi-item order with zero typing; layout is glass and works on mobile + desktop.

## TODO 31 — Add category filter chips to the picker
`P1 · S · apps/web/src/pages/CreateOrder.tsx`
Add chips: "All" + one per category (glass pills; active chip = black pill). Tapping filters the browsable product list instantly.
**Done when:** category chips filter products with one tap.

## TODO 32 — Add +/- quantity steppers to order lines
`P1 · S · apps/web/src/pages/CreateOrder.tsx`
Replace raw number inputs on each order line with `−` / value / `+` steppers (keep manual typing as an option); 44px touch targets.
**Done when:** quantities adjust with one tap on mobile and desktop.

## TODO 33 — Add "N items in order" indicator + clear-all
`P2 · S · apps/web/src/pages/CreateOrder.tsx`
Show a live count of items in the order (e.g. a badge on the summary) and a "Clear all" action.
**Done when:** current selection is always visible and resettable.

---

## TODO 34 — Fix the PDF Cyrillic font-fallback crash (root cause)
`P0 · M · apps/api/src/lib/pdf.ts, apps/api/scripts/download-fonts.js`
Labels are hard-coded Cyrillic (`PDF_LABELS`). The code registers DejaVu but **falls back to Helvetica** when the font can't be resolved — Helvetica (WinAnsi) can't encode Cyrillic → pdfkit throws / request 500s. Fix: guarantee the DejaVu TTF is present at runtime (bundle it or verify the `dejavu-fonts-ttf` resolve path in production; check `download-fonts.js`), fail loudly at startup if missing, and never draw non-Latin text with a Latin-only font.
**Done when:** PDF generation never crashes; Cyrillic/Albanian/Turkish characters render correctly.

## TODO 35 — Fix PDF totals/notes overflowing the footer
`P0 · S · apps/api/src/lib/pdf.ts`
The notes box is a fixed 36pt height regardless of text, and `drawTotals`/`drawNotes` don't page-break. Measure note text height (multi-line, dynamic box) and add a page break before totals/notes when they won't fit above the footer.
**Done when:** long notes and 15+ line orders paginate cleanly, no overlap with the footer, no trailing blank page.

## TODO 36 — Fix long product names overlapping PDF rows
`P1 · S · apps/api/src/lib/pdf.ts`
Rows use a fixed `ROW_HEIGHT` (20pt), so wrapped long names overlap the next row. Truncate with ellipsis or make row height dynamic.
**Done when:** long item names render without overlapping adjacent rows.

## TODO 37 — Make PDF language data-driven
`P1 · M · apps/api/src/lib/pdf.ts`
Replace hard-coded Macedonian `PDF_LABELS` with labels chosen by the order/tenant/user locale (EN/MK/SQ), using the same font fix from TODO 34.
**Done when:** an order PDF can be produced in any of the three languages.

## TODO 38 — Add PDF tests
`P1 · S · apps/api (vitest)`
Cases: 1-item order = 1 page; N-item pagination; long multi-paragraph notes; missing font (must not crash); non-Latin characters.
**Done when:** all cases covered and green in CI.

---

## TODO 39 — Add an Organization (tenant) model
`P0 · M · apps/api/prisma/schema.prisma`
Add `Organization` (id, name, slug, logoUrl, invoice name/address/regNo, currency, locale, plan, timestamps).
**Done when:** the model exists with a migration.

## TODO 40 — Scope all data to a tenant
`P0 · L · apps/api/prisma/schema.prisma + migration`
Add `organizationId` FK to User, Supplier, Product, Order, OrderItem, Reconciliation, InventoryMovement, etc. Write the migration and backfill existing rows into a default "AEM Residence" org.
**Done when:** every tenant-owned row has an `organizationId`.

## TODO 41 — Enforce tenant scoping on every query
`P0 · L · apps/api/src/routes/*, apps/api/src/lib/prisma.ts`
Add `organizationId` to all `where` clauses; prefer a Prisma middleware/extension or per-request scoped client so no query can leak across tenants.
**Done when:** no route can read or write another org's data.

## TODO 42 — Make currency & locale per-organization
`P1 · M · api + apps/web/src/lib/formatMKD.ts`
Replace the global MKD/`tr-TR` assumptions with the org's `currency` + `locale` (from TODO 39) in both API (PDF) and web formatting.
**Done when:** each org's money/dates render in its own currency and locale.

## TODO 43 — Write a cross-tenant isolation test (security)
`P0 · M · apps/api tests`
Integration test proving Org A can never read/write Org B's suppliers, products, orders, PDFs, or analytics.
**Done when:** the test passes in CI; treat any leak as a Sev-1 bug.

## TODO 44 — Make login/session org-aware
`P0 · M · apps/api/src/routes/auth.ts, middleware/auth.ts, types/session.d.ts`
User belongs to an organization; session carries `organizationId`; every request is scoped to it.
**Done when:** logged-in requests are automatically bound to the user's org.

## TODO 45 — Self-serve sign-up / create-organization
`P0 · L · api + web`
New customer registers → creates an organization + first admin user.
**Done when:** a new company can onboard with no manual DB work.

## TODO 46 — Invite teammates to an organization
`P1 · M · api + web`
Email invite → accept → set password, joining the inviter's org.
**Done when:** an admin can add colleagues to their workspace.

## TODO 47 — Formalize & enforce roles server-side
`P0 · M · apps/api/src/routes/*, middleware`
Define the ADMIN/MANAGER/VIEWER permission matrix and enforce on every route (don't trust the client `isAdmin`).
**Done when:** each role can only do what it's allowed, verified server-side.

## TODO 48 — Password reset & account settings
`P1 · M · api + web`
Standard reset flow + basic profile/account settings page (glass styling).
**Done when:** users can recover access and manage their account.

## TODO 49 — Per-organization branding
`P1 · M · apps/api/src/lib/pdf.ts, apps/web/src/assets`
Replace the hard-coded `COMPANY` block in the PDF with the org's details/logo; show the org logo in the app header.
**Done when:** each customer's app and PDFs show their own letterhead.

## TODO 50 — Migrate SQLite → PostgreSQL
`P1 · M · apps/api/prisma/schema.prisma, .env`
Switch the Prisma provider + `DATABASE_URL` to Postgres; verify migrations + seed on Postgres.
**Done when:** the app runs on Postgres in a staging environment.

## TODO 51 — Move the session store off local files
`P1 · M · apps/api/src/index.ts`
Replace `session-file-store` with a Postgres/Redis-backed store.
**Done when:** sessions survive restarts and scale across instances.

## TODO 52 — Integrate billing (Stripe)
`P1 · L · api + web`
Plans/tiers, trial, subscription lifecycle, dunning.
**Done when:** a customer can subscribe and access is tied to subscription status.

## TODO 53 — Feature gating & usage limits per plan
`P1 · M · api + web`
Gate features/limits by plan; add a glass billing/settings page.
**Done when:** plan limits are enforced and shown to the customer.

---

## TODO 54 — Full functionality QA pass
`P1 · M · whole app`
End-to-end verification of Auth (login/roles/rate-limit/route protection), Suppliers, Products, Orders, Inventory (deduction/insufficient-stock 409/audit), Reconciliation (loss → RECONCILED, keep `loss.test.ts` green), Control Panel (export), Analytics, PDF (TODO 34–38), i18n (EN/MK/SQ), and tenant isolation. Adapt `FIXES_TEST_CHECKLIST.md`.
**Done when:** every feature works after all changes.

## TODO 55 — Cross-browser & mobile QA
`P1 · S · whole app`
Test iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari — including the glass fallback.
**Done when:** app works and looks correct on all target browsers/devices.

## TODO 56 — Hosting & environments
`P2 · M · infra`
Choose a container host + managed Postgres; create dev/staging/prod with separate DBs and secrets.
**Done when:** all three environments deploy independently.

## TODO 57 — Production security hardening
`P2 · M · apps/api/src/index.ts, infra`
`secure` + `sameSite` cookies, HTTPS, helmet, CORS locked to the app origin, rate limiting, secrets management (never commit `.env`).
**Done when:** a security review of the deployed app passes.

## TODO 58 — Backups, monitoring & deploy pipeline
`P2 · M · infra`
DB backups + migration strategy; error monitoring (e.g. Sentry) + uptime; automated build/deploy (`build` shared→api→web, serve `apps/web/dist`, run API via `npm run start`).
**Done when:** deploys are automated and the app is observable in production.

---

## Login page fixes (from review 2026-07-14) · P1

## TODO 59 — Stop the "Authentication required" toast on the login screen
`P1 · S · apps/web/src/lib/api.ts, apps/web/src/App.tsx, apps/web/src/pages/Login.tsx`
On first load the session check (`GET /auth/me`) returns 401 for a logged-out visitor, and that 401 is surfaced as a global **"Authentication required"** error toast on the login page — which is wrong (being logged out is the normal state there). Treat a 401 from the auth/session check as "not logged in", not an error: skip the global error handler for the `auth/me` query (or suppress 401 toasts on the `/login` route / when unauthenticated).
**Done when:** loading the app while logged out shows the login page with **no** error toast; genuine errors still surface.

## TODO 60 — Reposition the login language picker
`P1 · S · apps/web/src/pages/Login.tsx`
The EN / Македонски / Shqip pills are crammed at the top-right inside the login card (`flex justify-end mb-5`), competing with the brand + form. Move them somewhere cleaner and secondary — recommend fixed at the **top-right of the viewport** (outside the card) or a centered, muted row **below** the card — and make them smaller so the card leads with the logo and form.
**Done when:** the language picker is visually separated from the form, balanced, and looks intentional on mobile and desktop.

## TODO 61 — Fix login brand inconsistency (logo vs placeholder vs title)
`P1 · S · apps/web/src/pages/Login.tsx, apps/web/index.html`
Login shows the **AEM Residence** script logo, the email placeholder is **`you@zubuild.com`**, and the page `<title>` is **AEM Residence** — three different identities. Pick one (per the branding decision) and make the logo, `<title>`, placeholder, and product name consistent.
**Done when:** login branding is internally consistent with the chosen product identity.

## TODO 62 — General login page polish / redesign
`P1 · S · apps/web/src/pages/Login.tsx`
Overall the login page needs tightening: consistent spacing, a proper brand lockup, aligned inputs, a clear primary sign-in button, and the "Forgot password?" / "Create organization" links styled as obvious secondary/link actions. Match the app's chosen theme + brand.
**Done when:** login looks clean, balanced, on-brand, and passes a quick design review.
