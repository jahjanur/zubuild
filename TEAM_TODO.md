# Zubuild — Team Delivery Plan & TODO

**Goal:** Turn the existing single-tenant "AEM Residence Operations" app into **Zubuild**, a multi-tenant SaaS for construction procurement & anti-theft that we can sell to other construction companies.

**Repo:** https://github.com/jahjanur/zubuild.git
**Source app it's based on:** AEM Residence Operations (React + Vite + TypeScript + Tailwind web; Node/Express + Prisma/SQLite API; shared Zod types — npm workspaces monorepo).

---

## How to use this document

- Each item is a checkbox — turn it into a ticket/issue.
- **Priority:** `P0` = must-have for first release · `P1` = important · `P2` = later · `P3` = nice-to-have.
- **Effort:** `S` ≈ <½ day · `M` ≈ 1–3 days · `L` ≈ 1–2 weeks.
- **Acceptance** = how we know it's done.
- File paths point at the exact place to work.

**Recommended order:** Workstream 0 → 1 (i18n) → 4 (PDF fix) → 3 (UI/UX) → 2 (SaaS) → 5 (QA) → 6 (deploy).

---

## Workstream 0 — Project setup (everyone, day 1) · P0

- [ ] **Clone & run locally** — `S`
  ```bash
  git clone https://github.com/jahjanur/zubuild.git
  cd zubuild
  npm install
  npm run build -w @zubuild/shared     # build shared types first (API depends on it)
  cp apps/api/.env.example apps/api/.env
  npm run db:migrate
  npm run db:seed
  npm run dev
  ```
  - Web: http://localhost:5173 · API: http://localhost:4000
  - **Login:** `admin@aem-residence.com` / `admin` (also `admin2@…` / `admin2`, `viewer@…` / `viewer`).
  - **Acceptance:** app loads, you can log in, dashboard shows seeded data.
- [ ] **Fix onboarding gotchas we hit** (so the next dev doesn't) — `S`
  - The old `README`/`RUN.md` say the password is `changeMeNow!` — it's actually `admin` (see `apps/api/prisma/seed.ts`). Fix the docs.
  - `npm run dev` fails on a fresh clone until `@zubuild/shared` is built. Add a `predev`/`prebuild` step or a root `postinstall` that builds shared. File: root `package.json`.
  - **Acceptance:** a brand-new clone runs with a single documented command sequence, no manual fix-ups.
- [ ] **Agree branching & PR conventions** — `S` (main protected, feature branches, PR review, CI).
- [ ] **Set up CI** (lint + typecheck + `npm run test` + build) on every PR — `M`.

---

## Workstream 1 — Internationalization: English, Macedonian, Albanian · P0

**Good news:** the UI is *already* fully wired for i18n. Every page uses `react-i18next`'s `t('key')` (see `apps/web/src/pages/*` — 12–65 keys each). Today it only ships **one** language file (Turkish) and is hard-locked to it in `apps/web/src/i18n/index.ts`. So this is mostly "add language files + a switcher," **not** re-touching every component.

- [ ] **Create the 3 translation files** — `M`
  - `apps/web/src/i18n/en.json` (English — **default**)
  - `apps/web/src/i18n/mk.json` (Macedonian, Cyrillic)
  - `apps/web/src/i18n/sq.json` (Albanian)
  - Use the existing `apps/web/src/i18n/tr.json` (~235 keys) as the key map — keep the exact same nested key structure; only values change.
  - Have a native/fluent speaker review MK and SQ, especially construction terms (units, "reconciliation", "supplier", "loss").
  - **Acceptance:** all three files have the same keys as `tr.json` (no missing keys); a script/CI check verifies key parity across all locale files.
- [ ] **Rewire i18n init** — `S` — file: `apps/web/src/i18n/index.ts`
  - Load `en`, `mk`, `sq` (decide whether to keep `tr`).
  - `fallbackLng: 'en'`, default `lng: 'en'`.
  - Persist the chosen language to `localStorage` and restore on load (optionally `i18next-browser-languagedetector`).
  - **Acceptance:** switching language persists across refresh.
- [ ] **Add a language switcher** — `S` — file: `apps/web/src/layout/AppLayout.tsx`
  - Place in the desktop sidebar footer and the mobile drawer. Also consider one on the `Login` page (`apps/web/src/pages/Login.tsx`) so users pick a language before logging in.
  - Labels: English / Македонски / Shqip.
  - **Acceptance:** every screen re-renders in the chosen language instantly.
- [ ] **Locale-aware formatting** — `M`
  - Numbers/currency: `apps/web/src/lib/formatMKD.ts` currently formats via a fixed locale. Make currency + number + date formatting follow the active language (`Intl.NumberFormat`/`Intl.DateTimeFormat`). Note: MKD (Macedonian denar) is the current currency — for SaaS this must become **per-tenant configurable** (see Workstream 2).
  - **Acceptance:** dates and money render correctly in each language; no hard-coded `tr-TR`.
- [ ] **Translate the PDF too** — `M` — file: `apps/api/src/lib/pdf.ts`
  - PDF labels are currently hard-coded Macedonian (`PDF_LABELS`) with a Turkish→ASCII transliteration path. Decide: PDF language follows the order's tenant/user locale. (See Workstream 4 — this ties into the font fix.)
  - **Acceptance:** an order PDF can be generated in EN / MK / SQ with correct characters.
- [ ] **QA pass for overflow** — `S` — longer languages (German-length strings, Albanian) can break buttons/nav. Check the sidebar, bottom bar, table headers, and modal titles don't clip.

---

## Workstream 2 — SaaS conversion (multi-tenancy) · P0/P1 (the big one)

Today the app is **single-tenant**: one company baked in (see the hard-coded `COMPANY` block in `apps/api/src/lib/pdf.ts`, single admin user, one shared database, MKD currency). To sell to multiple construction companies we need tenant isolation, onboarding, and billing.

### 2a. Data model & tenant isolation — P0 · `L`
- [ ] Add an **`Organization`** (tenant) model in `apps/api/prisma/schema.prisma` (name, slug, logo, address/contact for invoices, currency, locale, plan, createdAt).
- [ ] Add `organizationId` (FK) to every tenant-owned table: `User`, `Supplier`, `Product`, `Order`, `OrderItem`, `Reconciliation`, `InventoryMovement`, etc.
- [ ] Write a Prisma migration + backfill (existing rows → a default "AEM Residence" org).
- [ ] **Enforce tenant scoping on every query.** Add `organizationId` to all `where` clauses in `apps/api/src/routes/*.ts`. Strongly consider a Prisma middleware / extension or a per-request scoped client so no query can leak across tenants.
  - **Acceptance:** an integration test proves Org A can never read/write Org B's suppliers, products, orders, PDFs, analytics. This is a security requirement — treat cross-tenant leakage as a Sev-1 bug.
- [ ] Make **currency & locale per-organization** (replaces the global MKD/tr-TR assumptions in `formatMKD.ts` and `pdf.ts`).

### 2b. Auth, roles & onboarding — P0 · `L`
- [ ] **Org-aware login**: a user belongs to an organization; session carries `organizationId`. File: `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/types/session.d.ts`.
- [ ] **Sign-up / create-organization flow** (self-serve): create org + first admin, seed nothing or a starter set.
- [ ] **Invite teammates** to an org (email invite, accept, set password).
- [ ] **Roles/permissions** already partly exist (`ADMIN`, `MANAGER`, `VIEWER` in the schema comment; `useAuth`/`isAdmin` on the web). Formalize a permission matrix and enforce server-side on every route (don't trust the client).
- [ ] Password reset + basic account settings.
  - **Acceptance:** two separate orgs can each sign up, invite users, and operate in complete isolation.

### 2c. Billing & plans — P1 · `L`
- [ ] Choose a billing provider (Stripe is the default).
- [ ] Plans/tiers (e.g. by # users / # orders / features), subscription lifecycle, trial, dunning.
- [ ] Feature gating + usage limits per plan; a billing/settings page.
  - **Acceptance:** a new customer can subscribe, get access, and be down-graded/locked when they cancel or fail payment.

### 2d. Tenant branding & config — P1 · `M`
- [ ] Per-org **company details on the PDF/invoice** (name, address, reg no., logo) — replaces the hard-coded `COMPANY` in `apps/api/src/lib/pdf.ts`.
- [ ] Per-org logo in the app header (currently a fixed asset in `apps/web/src/assets/`).
  - **Acceptance:** each customer's orders/PDFs show *their* letterhead, not AEM's.

### 2e. Production database — P1 · `M`
- [ ] Move from SQLite to **PostgreSQL** (Prisma provider + `DATABASE_URL`). SQLite is fine for local dev but not for multi-tenant production (concurrency, hosting).
- [ ] Move the session store off the local file store (`session-file-store`) to Postgres/Redis. File: `apps/api/src/index.ts`.
  - **Acceptance:** app runs on Postgres in a staging environment; sessions survive restarts and scale horizontally.

---

## Workstream 3 — UI/UX modernization: official white theme · P1

Direction agreed: **clean, official, simple** palette suitable for a construction company — light/white mode, one restrained professional accent (blue), no dark "premium gold" look.

- [ ] **Convert the theme to a white/light corporate palette** — `M`
  - Design tokens live in `apps/web/src/styles/theme.css` (CSS vars) + `apps/web/tailwind.config.js` (literal colors) + global rules in `apps/web/src/index.css`. Change values there; the app uses semantic tokens (`bg-app-bg`, `text-app-primary`, `text-app-accent`, `border-[var(--border)]`), so a token swap re-skins the whole app.
  - Watch for dark-mode assumptions to convert: `hover:bg-white/10`, `border-white/15`, the focus ring color in `index.css`, the date-picker `filter: invert(1)`, and the loading screen in `App.tsx`.
  - **Acceptance:** every page (dashboard, orders, products, suppliers, create order, reconciliation, control panel, analytics, login, modals, dropdowns, toasts) is legible and consistent in light mode with good contrast (WCAG AA).
  - *(Note: a first pass at this already exists on the branch — review, refine spacing/typography, and make it production-quality.)*
- [ ] **Simplify item selection in Create Order** — `M` — file: `apps/web/src/pages/CreateOrder.tsx`
  - Current flow requires typing ≥2 chars to search before you can add a product, plus a separate "recent" chip row and a custom supplier combobox. Users find it fiddly.
  - Proposed: a **browse-first picker** — show all active products as tappable cards/rows grouped by category with category filter chips (no typing required), keep search as an optional filter, tap to add, `+/−` steppers for quantity, and a clear "N items in order" indicator. Use the existing `GET /products` (and `/products/search`) endpoints.
  - **Acceptance:** a new user can build a multi-item order without typing; adding/removing/adjusting quantities is one tap; works on mobile and desktop.
- [ ] **Design system polish** — `M` — audit the reusable primitives in `apps/web/src/components/ui/` (Button, Card, Modal, Input, Select, Table, Badge, StatCard) for consistent radius, spacing, shadows, and states (hover/focus/disabled) in the new theme.
- [ ] **Rebrand visuals** — `S` — replace the AEM logo/favicon with the Zubuild logo (`apps/web/src/assets/`, `apps/web/public/favicon.svg`), update product name strings (mostly in the locale files under `login.title`, etc.).
- [ ] **Responsive/mobile QA** — `S` — sidebar, bottom bar, sticky order-summary, modals on small screens.
- [ ] **Accessibility pass** — `M` — focus order, aria labels, color contrast, keyboard nav on dropdowns/modals.

---

## Workstream 4 — PDF generation: fix the crashes · P0

File: `apps/api/src/lib/pdf.ts` (backend, `pdfkit`). Root causes we identified:

- [ ] **Cyrillic + font fallback crash (most likely cause of the reported crashes)** — `M`
  - Labels are hard-coded Macedonian **Cyrillic** (`PDF_LABELS`). The code registers the `DejaVu` font (which supports Cyrillic) but **falls back to Helvetica** if the font file can't be resolved. Helvetica (WinAnsi) **cannot encode Cyrillic** → `pdfkit` throws and the request 500s / the PDF fails to load.
  - Fixes: (1) guarantee the DejaVu font is present at runtime (bundle it / verify the `dejavu-fonts-ttf` path resolves in production, or check the `fonts` script `apps/api/scripts/download-fonts.js`); (2) if the font is missing, fail loudly at startup rather than mid-render; (3) never draw Cyrillic with a Latin-only font.
  - **Acceptance:** generating a PDF with the DejaVu font absent does **not** crash; with it present, Cyrillic/Albanian/Turkish characters render correctly.
- [ ] **Totals/Notes overflow onto/past the footer** — `S/M`
  - The table reserves bottom space (`RESERVED_BOTTOM`), but `drawTotals`/`drawNotes` don't add a page if they don't fit, and the notes box is a **fixed 36pt height** regardless of text length — long notes overflow the box and can collide with the footer.
  - Fixes: measure text height for notes (multi-line, dynamic box), and add a page break before totals/notes if they won't fit above the footer.
  - **Acceptance:** a 15+ line order and a long multi-paragraph note both paginate cleanly; no content overlaps the footer; no trailing blank page.
- [ ] **Long product names** — `S` — names wider than the column wrap but the row rectangle is a fixed `ROW_HEIGHT` (20pt), so text overlaps the next row. Either truncate with ellipsis or make row height dynamic.
- [ ] **Make PDF language + company details data-driven** — `M` — ties into Workstream 1 (translate labels) and Workstream 2d (per-tenant `COMPANY`). Remove the hard-coded `COMPANY` and Macedonian-only labels.
- [ ] **Add PDF tests** — `S` — unit/snapshot tests for: 1-item order = 1 page, N-item order paginates, long notes, missing font, non-Latin characters. There's already a test setup (`vitest`) in `apps/api`.

---

## Workstream 5 — Functionality QA / verification checklist · P1

Go through every feature end-to-end and confirm it still works after the changes above. (Adapt the existing `FIXES_TEST_CHECKLIST.md` / `PDF_FIXES_SUMMARY.md`.)

- [ ] **Auth:** login (valid/invalid/rate-limit), logout, session persistence, role-based access (admin vs viewer), unauthorized route protection.
- [ ] **Suppliers:** create/edit/delete, ACTIVE/INACTIVE, search, validation (phone digits only).
- [ ] **Products:** create/edit/delete, categories, measurement units, price, search, "recent products."
- [ ] **Orders:** create with multiple items, unique `ORD-` number, snapshots, totals, list/filter/search, view modal, status changes.
- [ ] **Inventory:** stock deduction on order create, insufficient-stock guard (409), manual adjustments, movement audit trail.
- [ ] **Reconciliation:** ordered vs received, loss computation, order → RECONCILED. (There's a `loss.test.ts` — keep it green.)
- [ ] **Control Panel:** incidents, summary stats, details modal, CSV/Excel export.
- [ ] **Analytics:** overview stats, low-stock count, monthly loss trend, loss-rate doughnut, top items.
- [ ] **PDF:** all cases in Workstream 4.
- [ ] **i18n:** every screen in EN/MK/SQ, persisted, no missing keys, no overflow.
- [ ] **Multi-tenant isolation:** the cross-tenant test from Workstream 2a.
- [ ] **Cross-browser + mobile** (iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari).

---

## Workstream 6 — Deployment & infrastructure · P2

- [ ] Hosting decision (the current README mentions Hostinger; for SaaS consider a container host + managed Postgres).
- [ ] Environments: dev / staging / production, with separate DBs and secrets.
- [ ] Secrets management (`SESSION_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`, billing keys) — never commit `.env`.
- [ ] Production hardening: `secure` + `sameSite` cookies, HTTPS, `helmet`, CORS locked to the app origin, rate limiting (already partially in place).
- [ ] Backups & migrations strategy for the production DB.
- [ ] Error monitoring + logging (e.g. Sentry) and uptime monitoring.
- [ ] Build/deploy pipeline: `npm run build` (shared → api → web); serve `apps/web/dist`; run API with `npm run start`.

---

## Suggested milestones

| Milestone | Contents | Rough target |
|---|---|---|
| **M1 — Rebranded baseline** | Workstream 0 done; app runs as "Zubuild"; docs fixed | Week 1 |
| **M2 — Localized + polished** | Workstream 1 (EN/MK/SQ) + 3 (white theme, item selection) + 4 (PDF fixes) | Weeks 2–3 |
| **M3 — Multi-tenant core** | Workstream 2a + 2b (tenant isolation, org auth, onboarding) + 2e (Postgres) | Weeks 4–6 |
| **M4 — Sellable SaaS** | Workstream 2c (billing) + 2d (branding) + 5 (full QA) + 6 (deploy) | Weeks 7–9 |

---

## Key facts the team should know (from a code review of the current app)

- **Monorepo** (npm workspaces): `apps/web` (React/Vite), `apps/api` (Express/Prisma), `packages/shared` (Zod types). Package scope is `@zubuild/*`.
- **The UI is already internationalized** — adding languages is data, not a rewrite.
- **PDF crashes are most likely the Cyrillic-vs-Helvetica font issue** — start there.
- **DB is SQLite + Prisma** — fine for dev, must become Postgres for SaaS.
- **It's single-tenant today** — multi-tenancy (Workstream 2) is the largest and highest-risk effort; do the data-isolation test first and treat leaks as security bugs.
- **Seed logins:** `admin@aem-residence.com` / `admin`, `admin2@…` / `admin2`, `viewer@…` / `viewer` (defined in `apps/api/prisma/seed.ts`).
