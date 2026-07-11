# AEM Residence Operations & Anti-Theft

Production-ready construction procurement management with delivery reconciliation and loss analytics. Monorepo: React (Vite + TypeScript + Tailwind) + Node.js (Express + TypeScript) + shared types/validators.

## Features

- **Secure admin login** — Server-side session auth (httpOnly cookies), file-based session store (local), rate-limited login
- **Suppliers & Products** — CRUD, ACTIVE/INACTIVE status; only ACTIVE used in orders
- **Orders** — Create with product snapshots, unique `ORD-{id}` numbers, backend PDF generation
- **Reconciliation** — Ordered vs received per item, loss computation, order status → RECONCILED
- **Control Panel** — Incidents with loss, summary stats, view details modal, CSV export, inventory movements table
- **Inventory** — Stock on hand and reorder level per product; atomic deduction on order create; manual adjustments; audit trail (inventory_movements)
- **Analytics** — Overview stats, low-stock count, 6-month loss trend, loss-rate doughnut, top 5 items
- **UI** — Minimal premium theme, sidebar (desktop) / bottom nav (mobile), reusable Card/StatCard/Badge/Button/Modal

## Stack

- **Monorepo**: `apps/web`, `apps/api`, `packages/shared`
- **DB**: SQLite (local dev, no Docker) + Prisma (migrations, seed). Production can switch to PostgreSQL.
- **Validation**: Zod in `packages/shared`
- **Auth**: express-session + session-file-store (sessions in files; no native deps), secure cookies, rate limit on login
- **Security**: Helmet, CORS for web origin only, input sanitization

## No Docker required — Run locally

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Then open the web URL (e.g. http://localhost:5173) and log in with:

- **Email:** `admin@aem-residence.com`
- **Password:** `admin`

If port 4000 is in use: `npm run dev:kill` then `npm run dev` again.

### Migrate and seed (after schema changes)

```bash
npm run db:migrate
npm run db:seed
```

### Test inventory (stock) walkthrough

1. **Create a product with stock:** Products → Add product → set name, category, unit, price, **Stock on hand: 100**, Reorder level: 10 → Create.
2. **Create an order:** Create order → choose supplier and date → add the product (button shows “Available: 100”) → set quantity 10 → Create order.
3. **Verify stock:** Products → same product should show **Stock: 90**. Inventory (or Control Panel → Inventory movements) shows one movement: ORDER_CREATE, delta -10.
4. **Insufficient stock:** Create order again, add same product, set quantity 95. Submit should be disabled (or API returns 409: “Insufficient stock for … Available: 90, requested: 95”).
5. **Manual adjust:** Inventory → Adjust stock → select product → delta +50, reason “Restock” → Save. Products → stock should be 140.

### Test PDF export (no blank pages)

1. **1-item order → 1 page:** Create order → add exactly one product → submit → View/Download PDF. PDF must have **exactly 1 page** (no blank pages 2–3).
2. **Multi-page, no trailing blanks:** Create an order with 15+ line items → submit → download PDF. All pages should have content; no blank pages at the end. Header row repeats on continuation pages; footer on every page: “Generated: YYYY-MM-DD HH:mm” and “Page X of Y”.
3. **Notes:** Create order with notes → PDF should show a Notes section (bordered box). If no notes, the section is omitted.

### Test Create Order — Recent Products (last created, max 5)

1. **Recent = last created:** Create Order page shows “Recent products” (max 5). These are the **most recently created** ACTIVE products, not most recently ordered.
2. **Immediate update:** Products → Add product → create a new product. Without refreshing the app, open Create Order (or switch to it). The new product should appear at the **top** of Recent products. (React Query invalidates `['products','recent']` on product create/update.)
3. **Search still works:** Use the search field to find products by name/category; recent chips and search results both add the product to the order.

---

## Setup (detailed)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

The API uses SQLite by default. Ensure `apps/api/.env` exists:

```bash
cp apps/api/.env.example apps/api/.env
```

`.env.example` sets `DATABASE_URL="file:./prisma/dev.db"` so the database file is created at `apps/api/prisma/dev.db`. Set `SESSION_SECRET` to any long random string. Optional: `PORT=4000`, `CORS_ORIGIN=http://localhost:5173`.

### 3. Migrate and seed

```bash
npm run db:migrate
npm run db:seed
```

Seed creates/updates the admin user (email above, password `admin`). If the user already exists, the password hash is updated so you never get stuck.

### 4. Run development

```bash
npm run dev
```

- **API:** http://localhost:4000
- **Web:** http://localhost:5173 (Vite may use 5174+ if 5173 is taken). The app proxies `/api` to the API: frontend calls `POST /api/auth/login` → backend receives `POST /auth/login`.

### 5. Build for production

```bash
npm run build
```

- API: run `npm run start` from repo root.
- Web: serve `apps/web/dist` as static files or from the API (see Hostinger notes).

## Scripts (root)

| Script            | Description                         |
|-------------------|-------------------------------------|
| `npm run dev`     | Run API + web in parallel           |
| `npm run dev:kill`| Kill process on port 4000 (macOS/Linux) |
| `npm run build`   | Build shared, API, web               |
| `npm run start`   | Start API (after build)             |
| `npm run db:migrate` | Deploy Prisma migrations (SQLite) |
| `npm run db:seed` | Seed admin user                     |
| `npm run test`    | Run API tests (loss computation)    |

**Dev-only:** `GET /debug/auth-check?email=admin@aem-residence.com` — returns `dbReachable`, `userExists` (no password). Disabled in production.

## API overview

- **Auth:** `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- **Suppliers:** `GET/POST /suppliers`, `PUT/DELETE /suppliers/:id`
- **Products:** `GET/POST /products`, `PUT/DELETE /products/:id`
- **Orders:** `GET /orders?status=`, `POST /orders`, `GET /orders/:id`, `PUT /orders/:id/status`, `GET /orders/:id/pdf`
- **Reconciliations:** `POST /reconciliations`, `GET /reconciliations`, `GET /reconciliations/:id`
- **Control:** `GET /control/summary`, `GET /control/incidents`, `GET /control/export.csv`
- **Analytics:** `GET /analytics/overview`, `GET /analytics/monthly-loss?months=6`, `GET /analytics/top-items?limit=5`, `GET /analytics/loss-rate`

Responses: `{ success, data?, error? }`. Errors use appropriate HTTP status codes.

## Tests

```bash
npm run test
```

Runs `apps/api` Vitest suite (e.g. loss computation in `src/lib/loss.test.ts`).

## Hostinger deployment

For production you can switch the app to PostgreSQL (change Prisma provider and `DATABASE_URL`) and use a Postgres-backed session store if desired. Backend: set env in hPanel (`DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`). Frontend: build and upload `apps/web/dist` or serve from API; set `VITE_API_BASE` to your API URL. Use `sameSite: 'lax'` and `secure: true` for cookies in production.

## Login troubleshooting

Login returns specific errors:

- **DB not reachable** — `DATABASE_URL` not set or SQLite file path wrong. Ensure `apps/api/.env` has `DATABASE_URL="file:./prisma/dev.db"` and you ran `npm run db:migrate`.
- **User not found** — Run `npm run db:seed`.
- **Invalid password** — Seed password is `admin`.
- **Session error** — Session store (file) failed; check write access to `apps/api/prisma/sessions/`.

Use `GET /debug/auth-check?email=admin@aem-residence.com` (dev only) to confirm `dbReachable: true` and `userExists: true` after seed.
