# Zubuild — QA checklist

Living test checklist for the whole app. Last full pass: 2026-07-13 — **all green**
(60/60 automated tests, 33/33 live E2E checks, i18n parity 303 keys × en/mk/sq/tr,
full build).

## How to run

```
npm run build          # shared + api + web typecheck/build
npm test               # API test suite (vitest)
node scripts/check-i18n-parity.mjs   # en/mk/sq/tr key parity
npm run dev            # API :4000 + web :5173
```

Login: `admin@aem-residence.com` / `admin` (ADMIN). Seed also has
`viewer@aem-residence.com` / `viewer` (VIEWER).

## Automated coverage (npm test)

| Suite | Covers |
|---|---|
| `lib/loss.test.ts` (6) | reconciliation loss math (missing qty, loss value, status) — **must stay green** |
| `lib/inventory.test.ts` (1) | stock delta math |
| `lib/tenant.test.ts` (17) | tenant scoping at the Prisma layer (org A can't touch org B) |
| `routes/tenant-http.test.ts` (15) | cross-tenant isolation through real routes incl. PDF + analytics |
| `routes/roles.test.ts` (17) | ADMIN/MANAGER/VIEWER matrix enforced server-side |
| `routes/auth-flow.test.ts` (4) | password reset + change-password |

## Manual E2E — each feature must work

### Auth & accounts
- [ ] Login (admin) → lands in app; **Logout** clears session.
- [ ] Session **survives an API restart** (DB-backed store) — reload, still logged in.
- [ ] **Register** a new company → creates org + first admin, auto-logged-in, empty & isolated tenant.
- [ ] **Forgot password** → reset link (dev shows it) → set new password → logged in; link is single-use.
- [ ] **Change password** (Account page) → wrong current rejected, correct updates it.

### Roles (server-enforced — don't trust the client)
- [ ] VIEWER: read-only; create/update/delete and CSV export return 403; no Team access.
- [ ] MANAGER: can create/edit suppliers/products/orders, reconcile, adjust inventory, export; **no** Team.
- [ ] ADMIN: everything incl. Team + Organization settings.

### Team (invites)
- [ ] Admin invites a teammate (email + role) → copyable `/accept-invite/:token` link.
- [ ] Invitee opens link → sets password → joins the **inviting** org, auto-logged-in, shows in Members.
- [ ] Revoke a pending invite; an org only sees/revokes its own.

### Suppliers / Products
- [ ] List, create, edit, (de)activate; delete blocked if supplier has orders (409).
- [ ] Products: category filter, search, "recent" strip; only ACTIVE products are orderable.

### Orders + PDF
- [ ] Create order (browse-first picker, category chips, +/- steppers, live item count, clear-all).
- [ ] Order list shows totals/summary; open an order; change status.
- [ ] **PDF**: 1-item → 1 page; 15+ items → header repeats, totals/notes on the last page above the footer, no trailing blank; long item names truncate (no overlap); Cyrillic/Albanian/Turkish render (no crash).

### Reconciliation → Control → Analytics
- [ ] Reconcile ordered vs received → missing qty + monetary loss; order → RECONCILED (`loss.test.ts` guards the math).
- [ ] Control Panel: incidents with loss, summary, CSV export.
- [ ] Analytics: overview stats, 6-month loss trend, loss-rate, top-5 items — **scoped to the caller's org**.

### Multi-tenancy & branding
- [ ] Two orgs never see each other's suppliers/products/orders/PDFs/analytics/invites (automated + spot-check).
- [ ] Per-org **currency & locale** drive money/date formatting in app + PDF.
- [ ] Per-org **branding**: logo shows in the app header and PDF letterhead; admin edits it in Account → Organization.

### i18n
- [ ] Switch EN / MK (Cyrillic) / SQ (also TR) — every screen translates; no missing keys (parity CI enforces).

## Notes / known limitations
- Email is **not** wired: invites and password resets are **link-based** (shown/logged, not emailed).
- Postgres is **staged** but not the default; local/CI run on SQLite. See `docs/POSTGRES.md`.
