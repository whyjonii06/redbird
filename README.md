# Redbird

The TypeScript-first, self-hosted e-commerce engine — end-to-end type-safe, and it runs **instantly**: no database to install, no Docker, no config.

![Tests](https://img.shields.io/badge/tests-288%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-end--to--end-blue)

---

## Why Redbird

- **Runs in seconds, zero setup** — ships with an embedded database (PGlite). `pnpm dev` and you have a real store running locally — **no PostgreSQL, no Docker, no `DATABASE_URL`**. Point it at PostgreSQL only when you go to production.
- **End-to-end type safety** — one TypeScript type flows from the database (Drizzle) through the API (tRPC) to your frontend. No GraphQL codegen, no drift.
- **You own it** — self-hosted, MIT, no per-transaction fees, no vendor lock-in.
- **Plugin + module architecture** — payments, shipping, taxes, email, analytics, reviews, loyalty… all swappable without touching core.
- **Guided setup wizard** — first run opens a UI to name your store, pick a currency, enable plugins and seed demo data — and writes your config for you.

---

## Quick start

### Spin up a full store in 60 seconds

```bash
npm create redbird-shop@latest my-store
cd my-store
npm install
npm run dev
```

You get a running **API** (embedded database, auto-migrated, seeded with demo
products) at `http://localhost:3000` and a **storefront** at
`http://localhost:5173` — **no PostgreSQL, no Docker, no config**. You own 100%
of the code; set `DATABASE_URL` to PostgreSQL when you go to production.

### Run the full platform (with the back office)

To work on Redbird itself or run the complete platform — API + back office +
storefront — clone the repo (**Node 22+, pnpm 9+; no database needed**):

```bash
git clone https://github.com/whyjonii06/redbird.git
cd redbird
pnpm install
pnpm dev
```

`pnpm dev` starts the API (port 3000), backoffice (port 3004), and storefront
(port 5173) concurrently — backed by an **embedded PGlite database that's
created and migrated automatically**. Nothing else to install.

### Complete the setup wizard

Open `http://localhost:3004` in your browser.

The wizard lets you name your store, pick a currency, enable plugins (Stripe, PayPal, shipping, VAT, email, etc.), and optionally seed demo data. On submit it writes `.env`, `redbird.meta.json`, and `packages/api/redbird.config.ts`, then boots the real API in the same process — no restart needed.

> **Windows:** everything works natively with PowerShell or CMD. WSL is not required.

The storefront is already included in `pnpm dev` at `http://localhost:5173`.

---

## Build your own storefront

The bundled storefront is a reference — real shops own their frontend. Scaffold a standalone, fully-owned storefront wired to your API:

```bash
npm create redbird-storefront@latest my-shop
# or: npx create-redbird-storefront my-shop
```

You get a clean Vite + React + tRPC project, **type-safe end-to-end** against your store via `@redbirdshop/api-types`, pointing at any API URL (`VITE_REDBIRD_API_URL`). Edit everything, theme it freely, deploy anywhere (Vercel, Netlify, your own server). No lock-in. The CLI + template live in `packages/create-storefront`.

For no-code theming of the bundled storefront instead, use the backoffice **Theme Editor** (design tokens — colours, fonts, radius — applied live, plus saved theme presets).

---

## Built for France & the EU 🇫🇷🇪🇺

Most commerce engines treat European compliance as an afterthought. Redbird
ships it in the core — a real differentiator for EU merchants:

- **Factur-X e-invoicing** — every order generates a compliant **PDF/A-3**
  invoice with the structured **CII XML (EN 16931)** embedded, ready for the
  French e-invoicing reform and tools like Chorus Pro. (`/invoices/:id/factur-x.pdf`)
- **Sequential legal invoice numbering** — gapless, atomic, per-year (`YYYY-NNNNNN`).
- **FEC export** — the mandatory French accounting file (*Fichier des Écritures
  Comptables*), balanced double-entry, straight from the back office.
- **EU VAT** — 27 countries, VIES validation, B2B reverse charge (plugin).
- **Mondial Relay** — relay-point search for French/Benelux delivery.

The back office is available in **English, French, Spanish and German**, and so
is the storefront.

---

## Architecture

Redbird is a pnpm workspace monorepo.

| Package | Description |
|---|---|
| `packages/core` | Engine: catalog, cart, orders, customers, stock, promotions, loyalty, webhooks. Supports PGlite (embedded) and PostgreSQL. |
| `packages/api` | tRPC HTTP server exposing all core services. Includes the first-run setup wizard. |
| `packages/plugin-sdk` | Types, helpers, and hook definitions for authoring custom plugins. |
| `packages/cli` | `forge` — CLI for DB migrations and admin tasks. |
| `apps/backoffice` | React + tRPC admin UI: products, orders, customers, plugins, settings. |
| `apps/storefront` | Reference React storefront with catalog, cart, and Stripe checkout. |
| `apps/marketplace` | Plugin marketplace UI, backed by the license server. |
| `services/license-server` | Hono-based service for PRO license verification and Stripe webhooks. |

---

## Plugins vs modules

Redbird has two extension surfaces, both managed from the backoffice **Marketplace**:

- **Plugins** — discrete *backend* providers (payments, shipping, tax, email) configured with credentials and wired into the engine. They ship no UI of their own.
- **Modules** — full *bundled features* (reviews, loyalty, gift cards, suppliers, brands, downloads, abandoned carts, webhooks). Each adds its own sidebar entry, page and (optionally) a settings screen. They're **free, ship with the build, and are off by default** — install / enable / disable / uninstall them from the Marketplace so the backoffice stays as lean as you want. The data layer lives in module packages; the thin tRPC router stays in the API so the end-to-end client type is never lost.

### Plugins

| Plugin | Description |
|---|---|
| `shipping-flat` | Flat-rate shipping with configurable zones and amounts. |
| `shipping-zones` | Zone-based shipping rates by country and weight. |
| `tax-rules` | Custom tax rules per country, region, and product class. |
| `vat-eu` | EU VAT calculation with home-country configuration. |
| `stripe` | Stripe payment intents, webhooks, and refunds. |
| `paypal` | PayPal order creation and capture. |
| `email-resend` | Transactional email via the Resend API. |
| `email-smtp` | Transactional email via any SMTP server. |
| `email-local` | In-memory email store for local development (viewable in the backoffice, no real sends). |
| `analytics` | Pageview and event tracking (pluggable provider). |

### Bundled modules

| Module | Description |
|---|---|
| Product Reviews | Customer reviews with moderation, auto-approve and a storefront widget. |
| Loyalty Program | Points customers earn and redeem at checkout. |
| Gift Cards | Issue and redeem store gift cards. |
| Suppliers | Manage suppliers and link them to products. |
| Brands | Manage product brands and manufacturers. |
| Digital Downloads | Attach downloadable files to products. |
| Abandoned Carts | Track carts left at checkout for recovery. |
| Webhooks | Send real-time event notifications to external URLs. |

---

## License server (local, for PRO features)

The license server runs on port 4000. To start it locally:

```bash
cd services/license-server
cp .env.example .env   # set ADMIN_TOKEN and PORT as needed
pnpm dev
```

Create a test PRO license:

```bash
curl -s -X POST http://localhost:4000/v1/licenses \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"email": "test@example.com", "plan": "pro", "test": true}'
# returns: {"key":"RB-TEST-...","email":"test@example.com","plan":"pro"}
```

Add the key to your store by setting it in the backoffice (Settings > License), or directly in `packages/api/redbird.config.ts`:

```ts
export default defineConfig({
  licenseKey: 'RB-TEST-...',
  licenseServerUrl: 'http://localhost:4000',
  // ...
})
```

Or via `.env`:

```
REDBIRD_LICENSE_SERVER_URL=http://localhost:4000
```

---

## Docker (production)

The `docker-compose.yml` at the repo root starts PostgreSQL, the license server, and the marketplace:

```bash
docker compose up -d
```

| Service | Port | Description |
|---|---|---|
| `postgres` | 5433 | PostgreSQL 16 (`user: redbird`, `db: redbird`) |
| `license-server` | 4000 | License verification and Stripe webhooks |
| `marketplace` | 5174 | Plugin marketplace UI |

The API has its own Dockerfile at `packages/api/Dockerfile`. Build and deploy it separately, pointing `DATABASE_URL` at the Postgres container.

For local development with a real Postgres (instead of PGlite):

```bash
pnpm db:up    # start postgres only
pnpm db:down  # stop it
```

---

## Contributing

```bash
pnpm test        # run the test suite (260 tests)
pnpm typecheck   # type-check all packages
pnpm lint        # lint with Biome
pnpm lint:fix    # auto-fix lint issues
pnpm format      # format with Biome
```
