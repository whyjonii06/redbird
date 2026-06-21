# Redbird — Roadmap

## Philosophie : souple comme PrestaShop, solide comme Shopify

PrestaShop donne une liberté totale mais les overrides de classes PHP cassent à chaque mise à jour.
Les marchands arrêtent de mettre à jour → boutiques en PHP 7 avec failles de sécurité non patchées.

Shopify est indestructible mais c'est une cage : Liquid sandbox, zéro liberté d'architecture.

**Redbird vise le juste milieu :**

```
Surfaces d'extension STABLES (contrat versionnée semver)
├── Plugin SDK   →  hooks typés, jamais d'override core
├── API tRPC     →  contrat stable, breaking changes = majeur seulement
└── Storefront   →  repo séparé, le dev possède 100% du frontend

Core Redbird (intouchable par les extensions)
├── DB migrations  →  ADD COLUMN uniquement, jamais DROP en mineur
├── Services       →  TypeScript strict, compile-time safety
└── Auth / RBAC    →  géré par le core, non bypassable
```

**La garantie :** si `@redbird/core` introduit un breaking change dans un mineur,
le build TypeScript du plugin du dev échoue avant même le déploiement.
Les marchands mettent à jour sans peur — leurs customisations ne cassent jamais en mineur.

---

## Ce qui est fait (juin 2026)

### Moteur e-commerce
- 257/257 tests, ~75-80% parité PrestaShop
- Plugin SDK avec 20+ hooks typés (order.paid, cart.updated…)
- tRPC v11, Drizzle ORM, Postgres 16 / PGlite tests
- Backoffice complet (orders, products, customers, promo, CMS, staff RBAC…)
- 3 thèmes CSS (classic, editorial, minimal) — visuels seulement
- Setup wizard first-run
- Migrations additive-only (ADD COLUMN IF NOT EXISTS, jamais DROP en mineur)
- Semver strict sur les exports TypeScript

### Infrastructure déployée (redbirdshop.dev)
- VPS Ionos Ubuntu 24.04, Docker Compose
- Landing page + marketplace + API + license server, tous en HTTPS
- Stripe test configuré et actif

---

## Roadmap par priorité

### 1. Finir le MVP actuel
- [x] Test end-to-end paiement (checkout → Stripe → commande) ✓ 19/06/2026
- [x] Backoffice déployé publiquement (nginx) ✓
- [ ] Emails transactionnels (Resend)
- [ ] Label taxes sur storefront

### 2. Architecture headless storefront ← CHANTIER CLÉ

**Problème actuel :** les "thèmes" ne changent que le CSS. La structure des pages
(layout homepage, fiche produit, panier) est du JSX hardcodé dans `apps/storefront`.
Un dev ne peut pas changer l'architecture d'une page sans modifier le source et rebuilder.

**Solution : storefront comme repo séparé et remplaçable**

```
API Redbird (stable, déployée, versionnée)
    ↑
    tRPC / REST
    ↓
Storefront (repo du marchand — full control)
    → Next.js, Remix, Vite, React Native, n'importe quoi
```

**Ce que ça débloque :**
- Dev → clone un starter kit `npx create-redbird-app`, modifie tout (layout, composants,
  animations, sections homepage…), déploie où il veut (Vercel, Netlify, son VPS)
- Non-dev → sélectionne un thème pré-construit dans un marketplace de thèmes
- Page builder (drag & drop sections) → long terme, mais architecturalement possible

**Plan d'exécution :**
1. [x] CLI `create-redbird-storefront` + template Vite/React/tRPC autonome (`packages/create-storefront`) — scaffolde un storefront 100% possédé par le dev, typé bout-en-bout via `@redbirdshop/api-types`, API configurable (`VITE_REDBIRD_API_URL`)
2. [ ] Publier `create-redbird-storefront` sur npm
3. [ ] Documenter les endpoints tRPC publics (contrat storefront)
4. [ ] Starters supplémentaires (Next.js App Router, Vue)
5. [ ] Marketplace de thèmes (soumission communauté)

**No-code (livré)** : Theme Editor backoffice — design tokens (couleurs/fontes/radius) appliqués live sans rebuild + presets de thèmes nommés. Slots storefront pour modules. Sections homepage en DB.

### 3. Redbird Desktop — Installeur one-click

**Cible :** commerçants non-dev qui veulent une boutique auto-hébergée en local.

**Concept :** app Tauri (.exe Windows / .app macOS) qui :
1. Vérifie/installe Docker Desktop
2. Pull les images Redbird depuis Docker Hub
3. Lance les containers (API + postgres + backoffice)
4. Ouvre le wizard de configuration dans le navigateur
5. Tourne en tâche de fond (systray), redémarre au boot

**Stack :** Tauri (Rust + WebView, ~5 MB vs Electron ~120 MB)
**Distribution :** GitHub Releases + auto-update intégré

### 4. Redbird Cloud — Mise en prod en un clic

**Cible :** dev et non-dev qui veulent mettre leur boutique en ligne sans terminal.

#### Flux utilisateur
1. Dans le backoffice : bouton **"Déployer en ligne"**
2. Questionnaire guidé :
   - VPS existant ? → entrer IP+creds
   - Pas de VPS → on en crée un (Hetzner API)
   - Domaine existant ? → entrer le domaine
   - Pas de domaine → sous-domaine offert `boutique.shops.redbirdshop.dev`
3. Paiement CB → on surfacture le coût VPS réel (marge service)
4. Agent IA prend la main (SSH) :
   - Crée le VPS via Hetzner Cloud API
   - Configure nginx, Docker, certificats SSL
   - Déploie le store + storefront
   - Lie le domaine / crée le sous-domaine via Cloudflare API
5. Client reçoit son URL fonctionnelle

#### Sous-domaines pour clients sans domaine
```
Option A (recommandée) : wildcard DNS + A record direct
*.shops.redbirdshop.dev  →  wildcard Cloudflare
shop-jean.shops.redbirdshop.dev  →  A → IP VPS Jean  (trafic direct)
shop-marie.shops.redbirdshop.dev →  A → IP VPS Marie (trafic direct)
```
- Un seul wildcard SSL cert `*.shops.redbirdshop.dev` (Let's Encrypt DNS challenge)
- Cloudflare API pour créer le sous-domaine automatiquement au déploiement
- Quand le client a son propre domaine → il pointe son A record, on génère un cert individuel

#### Gestion du code
- **Non-dev** : pas de git. Config/thème stockés dans la DB du license server,
  ré-appliqués automatiquement à chaque mise à jour ou redéploiement
- **Dev** : repo git personnel (GitHub ou Gitea self-hosted), webhook → redéploiement auto

#### Modèle économique
| Offre | Prix | Inclus |
|---|---|---|
| Redbird CE | Gratuit | Auto-hébergé, source disponible, full control |
| Redbird Desktop | Gratuit | Installeur local, pas de serveur |
| Redbird Cloud Starter | ~€29/mois | VPS 2 vCPU/4 GB + déploiement + SSL + mises à jour auto |
| Redbird Cloud Pro | ~€79/mois | VPS dédié + storefront custom + support |

### 5. Plugin marketplace
- Soumission de plugins communauté
- Installation depuis le backoffice (ModulesPage déjà prête)
- Vetting sécurité (audit TypeScript types + sandbox)

---

## Ce que Redbird ne fera jamais
- Overrides de classes core (le pattern PrestaShop qui casse tout)
- Breaking changes dans les mineurs sur les exports Plugin SDK
- DROP ou RENAME de colonnes en migrations mineures
- Accès base de données direct depuis les plugins (tout passe par les services core)
