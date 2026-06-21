# Redbird — État du projet

> Dernière mise à jour : 2026-06-16  
> Dernier commit : `7561dd4`  
> Tests : **63 passent** (8 fichiers de test)

---

## Ce qui est implémenté

### Engine core (`packages/core`)
- Catalog service — produits, variantes, CRUD, slugs
- Cart service — création, ajout/suppression/merge d'items, subtotal, multi-currency validation
- Order service — `createFromCart` (snapshot noms/prix), state machine (`pending → paid → fulfilled / cancelled / refunded`), `get`, `getByNumber`, `list`
- Customer service — `register` (scrypt/salt), `login` (timing-safe), `get`, `getByEmail`, `update` — `passwordHash` jamais exposé (`PublicCustomer`)
- Plugin/hook system — 15 hooks typés (`HookMap`), registry, emit séquentiel
- PaymentRegistry — multi-providers, `defaultPaymentProvider`, auto-découverte via duck-typing
- DB : Postgres 16 + Drizzle ORM, 2 migrations (`0000_init`, `0001_customers`)

### Plugins first-party (`plugins/`)
| Plugin | Ce qu'il fait |
|---|---|
| `@redbird/plugin-stripe` | PaymentIntents, HMAC webhook (`/webhooks/stripe`), dryRun |
| `@redbird/plugin-paypal` | Orders API v2, OAuth2, webhook REST verify (`/webhooks/paypal`), dryRun |
| `@redbird/plugin-shipping-flat` | Zones, taux fixe, seuil franchise (`freeOver`) |
| `@redbird/plugin-analytics` | Hooks Plausible/GA4/console |
| `@redbird/plugin-reviews` | Avis produits (schéma propre, CASCADE delete) |

### API (`packages/api`)
tRPC v11 — 4 routers montés sur `/trpc` :
- `catalog` — list, bySlug, byId, create, update, delete, addVariant
- `cart` — create, get, subtotal, addItem, removeItem, updateQuantity, clear
- `checkout` — createOrder, get, getByNumber, list, markPaid, markFulfilled, cancel, refund
- `customers` — register, login, get, update, orders

Webhooks HTTP raw montés sur `/webhooks/*` — auto-découverts depuis les plugins au démarrage du serveur. Sur confirmation paiement → `orders.markPaid(orderId)` automatique.

### Storefronts (`apps/`)
- `storefront-classic` — DTC, thème papier+cuivre (port 3001)
- `storefront-editorial` — magazine, Bodoni Moda (port 3002)
- `storefront-b2b` — wholesale, data-table, TVA HT (port 3003)

### CLI (`packages/cli`)
- `forge info` — état engine + DB
- `forge seed` — 6 produits café artisanal
- `forge create <name>` — scaffold boutique avec PayPal+Stripe+shipping pré-configurés

---

## Ce qui manque (liste priorisée)

### 🔴 Bloquant open source (à faire avant de pousser publiquement)

- [ ] **CI GitHub Actions** — lint + typecheck + test sur chaque PR
- [ ] **Licence MIT** — ajouter `"license": "MIT"` dans tous les `package.json` + fichier `LICENSE`

### 🔴 Fonctionnalités manquantes critiques

- [ ] **Email transactionnel** — confirmation commande, expédition, reset password, abandon panier. Aucune infrastructure email pour l'instant.
- [ ] **Moteur TVA EU** — taux par pays (standard/réduit/zéro), seuil OSS, reverse charge B2B, facturation conforme. Annoncé comme avantage face à Medusa dans le pitch — absent du code.
- [ ] **Back office** — le plus gros chantier (~25% du travail total). Sans ça, uniquement utilisable par des développeurs. Inclut : dashboard, gestion produits/commandes/clients, catalogue, promotions, rapports, rôles staff.

### 🟡 Fonctionnalités importantes

- [ ] **Internationalisation** — traductions produits, slugs localisés, affichage devises, formats d'adresse
- [ ] **Adresses client** — carnet d'adresses (facturation + livraison multiples)
- [ ] **Catégories produits** — arborescence de navigation
- [ ] **Images produits** — gestion, upload, optimisation
- [ ] **Gestion stock** — suivi, réservation, alertes rupture
- [ ] **Codes promo / réductions** — pourcentage, fixe, livraison gratuite, buy X get Y
- [ ] **Guest checkout** — commande sans compte
- [ ] **Notifications email commande** — dépend du point email ci-dessus

### 🟢 Écosystème & DX

- [ ] **`forge publish`** — publier un plugin sur npm
- [ ] **README par package/plugin** — doc d'usage
- [ ] **Outil de migration PS → Redbird (IA)** — analyse export PrestaShop, mapping schéma, détection modules incompatibles. Projet à part entière, 4-6 mois.
- [ ] **Tests storefronts** — aucun test sur les 3 apps Next.js
- [ ] **SEO** — sitemap.xml, JSON-LD, canonical URLs

---

## Évaluation honnête : ~10-15% d'un concurrent complet à PrestaShop

La fondation architecturale est solide (plugin system typé, tRPC, webhooks, tests). Mais en features utilisables par un marchand non-technique, on est à 10-15%.

| Domaine | Poids | Avancement |
|---|---|---|
| Engine core | 12% | ~35% |
| **Back office** | **25%** | **0%** |
| Storefronts/thèmes | 8% | 20% |
| Paiements | 7% | 40% |
| Email transactionnel | 6% | 0% |
| Internationalisation | 8% | 0% |
| **Moteur TVA EU** | **7%** | **0%** |
| Expérience client | 5% | 15% |
| Livraison | 5% | 10% |
| SEO & performance | 4% | 5% |
| Écosystème plugins | 5% | 20% |
| CI/CD + open source | 3% | 5% |
| **Migration IA** | **7%** | **0%** |
| Docs & DX | 3% | 5% |

**Pour aller en V0 publique viable** (sans migration IA ni back office complet) :
→ ~10 mois, 3 devs full-time, ~600k€ — cohérent avec le pitch.

**Pour le complet avec back office + migration IA** :
→ 24 mois, équipe de 5-6.

---

## Commandes utiles pour reprendre

```bash
# Démarrer la DB
docker compose up -d postgres

# Tests (doit afficher 63 passed)
pnpm test

# Storefronts
pnpm -F @redbird/storefront-classic dev      # http://localhost:3001
pnpm -F @redbird/storefront-editorial dev    # http://localhost:3002
pnpm -F @redbird/storefront-b2b dev          # http://localhost:3003

# CLI
node packages/cli/dist/index.js info
node packages/cli/dist/index.js seed
```

## Historique des sessions de travail

| Date | Ce qui a été fait |
|---|---|
| 2026-06-16 | Plugin PayPal (Orders API v2, OAuth2, dryRun) + PaymentRegistry |
| 2026-06-16 | Order flow complet — `createFromCart`, state machine, tRPC checkout (11 tests) |
| 2026-06-16 | Webhooks Stripe (HMAC) + PayPal (REST verify) + route `/webhooks/*` (8 tests) |
| 2026-06-16 | Customer accounts — register/login/scrypt, PublicCustomer, tRPC customers (11 tests) |
