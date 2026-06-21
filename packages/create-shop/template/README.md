# Redbird shop

A full e-commerce store — API + storefront — created with
[`create-redbird-shop`](https://www.npmjs.com/package/create-redbird-shop).

## Run it

```bash
npm install
npm run dev
```

That's it. No database to install, no Docker, no config:

- **API** → http://localhost:3000 (embedded PGlite database, created & migrated
  automatically, seeded with a few demo products)
- **Storefront** → http://localhost:5173

## What's inside

```
.
├── server.ts     # your Redbird API (runs on an embedded database)
├── web/          # your storefront (React + Vite, fully yours to edit)
└── package.json  # one install, one `npm run dev`
```

## Going to production

- Set `DATABASE_URL` to a PostgreSQL connection string (see `.env`).
- Deploy `server.ts` (any Node host) and `web/` (any static host).
- Add `STRIPE_SECRET_KEY` to accept real payments.

You own 100% of this code. Edit, theme and deploy it anywhere — no vendor lock-in.
