# create-redbird-shop

Scaffold a **full Redbird store** — API + storefront — that runs **instantly**:
no PostgreSQL, no Docker, no config.

```bash
npm create redbird-shop@latest my-store
cd my-store
npm install
npm run dev
```

- **API** on http://localhost:3000 — embedded PGlite database, created &
  migrated automatically, seeded with demo products
- **Storefront** on http://localhost:5173 — React + Vite, fully yours

Going to production? Set `DATABASE_URL` to PostgreSQL and deploy. You own 100%
of the code — no vendor lock-in, no per-transaction fees.

MIT licensed.
