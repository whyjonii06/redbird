# Redbird Storefront

A standalone storefront for your [Redbird](https://redbirdshop.dev) store — **you own 100% of this code.** Built with Vite + React + tRPC, fully type-safe against your store's API.

## Getting started

```bash
npm install
npm run dev
```

Set your API in `.env`:

```
VITE_REDBIRD_API_URL=http://localhost:3000
```

That's the URL of your running Redbird API (locally `http://localhost:3000`, in production e.g. `https://api.yourstore.com`).

## How it works

- `src/trpc.ts` — typed tRPC client. The `AppRouter` type comes from `@redbirdshop/api-types`, so every query is autocompleted and type-checked against your store.
- `src/meta.ts` — fetches store name, currency and branding from `/meta.json`.
- `src/pages/` — Home, Product and Cart. Add your own pages, components and styles freely.

## Make it yours

This is a starter, not a black box. Change the layout, swap Tailwind for anything, add routes, integrate checkout (`trpc.checkout.*`), wire payments — it's your codebase.

## Deploy

It's a static Vite build (`npm run build` → `dist/`). Deploy to Vercel, Netlify, Cloudflare Pages, your own server — anywhere. Just set `VITE_REDBIRD_API_URL` to your production API.
