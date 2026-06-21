# create-redbird-storefront

Scaffold a standalone, fully-owned [Redbird](https://redbirdshop.dev) storefront.

```bash
npm create redbird-storefront@latest my-shop
# or
npx create-redbird-storefront my-shop
```

You'll be asked for your Redbird API URL, then get a clean Vite + React + tRPC
project that's **100% yours** — type-safe against your store's API, deployable
anywhere.

```bash
cd my-shop
npm install
npm run dev
```

## Why

Redbird's headless API is the product. The reference storefront ships in the
monorepo, but real shops want to own their frontend. This CLI gives you a
minimal, clean starting point wired to your API — no lock-in, no magic, edit
everything.
