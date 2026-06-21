/**
 * Demo data seeder — showcases all Redbird features.
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@localhost/redbird pnpm --filter @redbirdshop/core seed
 *
 * Requires a migrated PostgreSQL database. Truncates existing data first.
 */

import { sql } from 'drizzle-orm'
import { createRedbird } from '../src/redbird.js'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://redbird:redbird@localhost:5433/redbird'

const rb = createRedbird({
  databaseUrl: DATABASE_URL,
  storeName: 'Redbird Demo Store',
  defaultCurrency: 'EUR',
})

function img(seed: string | number, w = 800, h = 800) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

function eur(amount: number) {
  return Math.round(amount * 100)
}

function log(label: string, detail = '') {
  const pad = detail ? `  ${label.padEnd(18)} ${detail}` : `\n  ▸ ${label}`
  console.log(pad)
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Seeding Redbird demo data…')

  await rb.init()

  // ── 0. Reset ───────────────────────────────────────────────────────────────
  console.log('\n  ▸ Resetting tables')
  await rb.db.execute(sql`
    TRUNCATE TABLE
      webhook_deliveries, webhooks,
      gift_card_transactions, gift_cards,
      loyalty_transactions, loyalty_accounts,
      product_reviews,
      return_requests,
      order_line_items, orders,
      cart_line_items, carts,
      product_relations,
      variant_attribute_values, attribute_values, product_attributes,
      product_images, product_translations, product_categories,
      product_variants, products,
      categories,
      brands,
      product_suppliers, suppliers,
      customers,
      promo_codes,
      cms_pages,
      download_tokens, product_downloads
    RESTART IDENTITY CASCADE
  `)

  // ── 1. Brands ──────────────────────────────────────────────────────────────
  console.log('\n  ▸ Brands')
  const [artisan, techwave, ecoverde] = await Promise.all([
    rb.brands.create({ name: 'Artisan Co.', slug: 'artisan-co', description: 'Handcrafted goods by local artisans.', websiteUrl: 'https://example.com' }),
    rb.brands.create({ name: 'TechWave', slug: 'techwave', description: 'Modern tech accessories for productivity.' }),
    rb.brands.create({ name: 'EcoVerde', slug: 'ecoverde', description: 'Sustainable and eco-friendly everyday products.' }),
  ])
  log('Artisan Co. / TechWave / EcoVerde')

  // ── 2. Categories ──────────────────────────────────────────────────────────
  console.log('\n  ▸ Categories')
  const catClothing = await rb.categories.create({ name: 'Clothing', slug: 'clothing', description: 'Apparel for every occasion' })
  const catElec = await rb.categories.create({ name: 'Electronics', slug: 'electronics', description: 'Gadgets and tech accessories' })
  const catAccess = await rb.categories.create({ name: 'Accessories', slug: 'accessories', description: 'The finishing touch' })
  const catTops = await rb.categories.create({ name: 'Tops', slug: 'tops', parentId: catClothing.id })
  const catBottoms = await rb.categories.create({ name: 'Bottoms', slug: 'bottoms', parentId: catClothing.id })
  log('5 categories (Clothing → Tops/Bottoms, Electronics, Accessories)')

  // ── 3. Products ────────────────────────────────────────────────────────────
  console.log('\n  ▸ Products')

  const pTshirt = await rb.catalog.createProduct(
    { name: 'Linen T-Shirt', slug: 'linen-tshirt', description: 'A lightweight 100% linen T-shirt, perfect for warm weather. Breathable, durable, and timeless.', status: 'active', brandId: artisan.id, metaTitle: 'Linen T-Shirt — Artisan Co.', metaDescription: 'Handcrafted 100% linen T-shirt, available in S, M, L.' },
    [
      { sku: 'LTS-S', name: 'Small', priceAmount: eur(29.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { size: 'S' } },
      { sku: 'LTS-M', name: 'Medium', priceAmount: eur(29.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { size: 'M' } },
      { sku: 'LTS-L', name: 'Large', priceAmount: eur(29.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { size: 'L' } },
    ],
  )
  log('Linen T-Shirt', '3 variants (S/M/L)')

  const pChinos = await rb.catalog.createProduct(
    { name: 'Slim Chinos', slug: 'slim-chinos', description: 'Tailored slim-cut chinos in durable cotton twill. Versatile for office or weekend.', status: 'active', brandId: artisan.id },
    [
      { sku: 'CHN-30', name: 'W30', priceAmount: eur(59), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { waist: '30' } },
      { sku: 'CHN-32', name: 'W32', priceAmount: eur(59), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { waist: '32' } },
      { sku: 'CHN-34', name: 'W34', priceAmount: eur(59), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { waist: '34' } },
    ],
  )
  log('Slim Chinos', '3 variants (W30/32/34)')

  const pEarbuds = await rb.catalog.createProduct(
    { name: 'Aero Wireless Earbuds', slug: 'aero-wireless-earbuds', description: 'True wireless earbuds with 30h battery, active noise cancellation, and IPX5 water resistance.', status: 'active', brandId: techwave.id, metaTitle: 'Aero Wireless Earbuds — TechWave', metaDescription: 'True wireless earbuds: ANC, 30h battery, IPX5. Midnight Black and Pearl White.' },
    [
      { sku: 'AWE-BLK', name: 'Midnight Black', priceAmount: eur(89), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { color: 'Black' } },
      { sku: 'AWE-WHT', name: 'Pearl White', priceAmount: eur(89), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { color: 'White' } },
    ],
  )
  log('Aero Wireless Earbuds', '2 variants (Black / White)')

  const pHub = await rb.catalog.createProduct(
    { name: '7-in-1 USB-C Hub', slug: 'usbc-hub-7in1', description: 'Expand your laptop: 2× USB-A 3.0, USB-C PD 100W, HDMI 4K, SD & MicroSD, Gigabit Ethernet.', status: 'active', brandId: techwave.id },
    [{ sku: 'HUB-C7', name: 'Default', priceAmount: eur(49.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: {} }],
  )
  log('7-in-1 USB-C Hub', '1 variant')

  const pBottle = await rb.catalog.createProduct(
    { name: 'Bamboo Water Bottle 750ml', slug: 'bamboo-water-bottle', description: 'Double-walled insulated bottle with sustainable bamboo exterior. Cold 24h, hot 12h.', status: 'active', brandId: ecoverde.id },
    [
      { sku: 'BWB-NAT', name: 'Natural', priceAmount: eur(34), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { color: 'Natural' } },
      { sku: 'BWB-GRN', name: 'Forest Green', priceAmount: eur(34), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { color: 'Green' } },
    ],
  )
  log('Bamboo Water Bottle', '2 variants (Natural / Green)')

  const pTote = await rb.catalog.createProduct(
    { name: 'Recycled Canvas Tote', slug: 'recycled-canvas-tote', description: '100% recycled canvas tote bag. Durable, washable, with interior zip pocket.', status: 'active', brandId: ecoverde.id },
    [{ sku: 'RCT-NAT', name: 'Natural', priceAmount: eur(19.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: {} }],
  )
  log('Recycled Canvas Tote', '1 variant')

  const pBeanie = await rb.catalog.createProduct(
    { name: 'Merino Wool Beanie', slug: 'merino-beanie', description: 'Extra-fine merino wool beanie. Ultra-soft, non-itch, naturally temperature-regulating.', status: 'active', brandId: artisan.id },
    [{ sku: 'MWB-ONE', name: 'One Size', priceAmount: eur(24.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: {} }],
  )
  log('Merino Wool Beanie', '1 variant')

  const pWallet = await rb.catalog.createProduct(
    { name: 'Slim Leather Card Wallet', slug: 'slim-leather-wallet', description: 'Full-grain vegetable-tanned leather card wallet. Holds 8 cards. Minimal and elegant.', status: 'active', brandId: artisan.id },
    [
      { sku: 'LCW-TAN', name: 'Tan', priceAmount: eur(39), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { color: 'Tan' } },
      { sku: 'LCW-BLK', name: 'Black', priceAmount: eur(39), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: { color: 'Black' } },
    ],
  )
  log('Slim Leather Wallet', '2 variants (Tan / Black)')

  const pEbook = await rb.catalog.createProduct(
    { name: 'Sustainable Living Guide (E-Book)', slug: 'sustainable-living-ebook', description: 'A 120-page guide to reducing your environmental footprint. Instant digital download.', status: 'active', brandId: ecoverde.id, isVirtual: true },
    [{ sku: 'EBOOK-SLG', name: 'Digital Edition', priceAmount: eur(9.9), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: {} }],
  )
  log('Sustainable Living Guide (e-book)', 'virtual product')

  // Draft — visible in backoffice, hidden from storefront
  await rb.catalog.createProduct(
    { name: 'Upcoming Sneaker Collection', slug: 'upcoming-sneakers', description: 'Coming soon.', status: 'draft' },
    [{ sku: 'UCS-TMP', name: 'Default', priceAmount: eur(120), priceCurrency: 'EUR', inventoryQuantity: 0, attributes: {} }],
  )
  log('Upcoming Sneakers', '(draft — not visible)')

  // ── 4. Images ──────────────────────────────────────────────────────────────
  console.log('\n  ▸ Images')
  await Promise.all([
    rb.images.add(pTshirt.id, { url: img('tshirt-1'), alt: 'Linen T-Shirt front view', position: 0 }),
    rb.images.add(pTshirt.id, { url: img('tshirt-2'), alt: 'Linen T-Shirt detail', position: 1 }),
    rb.images.add(pChinos.id, { url: img('chinos-1'), alt: 'Slim Chinos', position: 0 }),
    rb.images.add(pEarbuds.id, { url: img('earbuds-1'), alt: 'Aero Wireless Earbuds', position: 0 }),
    rb.images.add(pEarbuds.id, { url: img('earbuds-2'), alt: 'Aero Wireless Earbuds case', position: 1 }),
    rb.images.add(pHub.id, { url: img('hub-1'), alt: '7-in-1 USB-C Hub', position: 0 }),
    rb.images.add(pBottle.id, { url: img('bottle-1'), alt: 'Bamboo Water Bottle Natural', position: 0 }),
    rb.images.add(pBottle.id, { url: img('bottle-2'), alt: 'Bamboo Water Bottle Forest Green', position: 1 }),
    rb.images.add(pTote.id, { url: img('tote-1'), alt: 'Recycled Canvas Tote', position: 0 }),
    rb.images.add(pBeanie.id, { url: img('beanie-1'), alt: 'Merino Wool Beanie', position: 0 }),
    rb.images.add(pWallet.id, { url: img('wallet-1'), alt: 'Slim Leather Wallet Tan', position: 0 }),
    rb.images.add(pWallet.id, { url: img('wallet-2'), alt: 'Slim Leather Wallet Black', position: 1 }),
    rb.images.add(pEbook.id, { url: img('ebook-1'), alt: 'Sustainable Living Guide cover', position: 0 }),
  ])
  log('13 images added')

  // ── 5. Stock ───────────────────────────────────────────────────────────────
  console.log('\n  ▸ Stock')
  const [fTshirt, fChinos, fEarbuds, fHub, fBottle, fTote, fBeanie, fWallet] = await Promise.all([
    rb.catalog.getProductById(pTshirt.id),
    rb.catalog.getProductById(pChinos.id),
    rb.catalog.getProductById(pEarbuds.id),
    rb.catalog.getProductById(pHub.id),
    rb.catalog.getProductById(pBottle.id),
    rb.catalog.getProductById(pTote.id),
    rb.catalog.getProductById(pBeanie.id),
    rb.catalog.getProductById(pWallet.id),
  ])

  const stockMap: Record<string, number> = {
    // T-shirt: S sold-out, M abundant, L limited
    ...(fTshirt ? { [fTshirt.variants[0]!.id]: 0, [fTshirt.variants[1]!.id]: 22, [fTshirt.variants[2]!.id]: 8 } : {}),
    // Chinos
    ...(fChinos ? Object.fromEntries(fChinos.variants.map((v) => [v.id, 15])) : {}),
    // Earbuds
    ...(fEarbuds ? Object.fromEntries(fEarbuds.variants.map((v) => [v.id, 20])) : {}),
    // Hub — limited
    ...(fHub ? { [fHub.variants[0]!.id]: 6 } : {}),
    // Bottle
    ...(fBottle ? Object.fromEntries(fBottle.variants.map((v) => [v.id, 40])) : {}),
    // Tote
    ...(fTote ? { [fTote.variants[0]!.id]: 80 } : {}),
    // Beanie — low stock
    ...(fBeanie ? { [fBeanie.variants[0]!.id]: 3 } : {}),
    // Wallet
    ...(fWallet ? Object.fromEntries(fWallet.variants.map((v) => [v.id, 12])) : {}),
  }

  await Promise.all(Object.entries(stockMap).map(([variantId, qty]) => rb.stock.set(variantId, qty)))
  log(`Stock set for ${Object.keys(stockMap).length} variants`)

  // ── 6. Category assignments ────────────────────────────────────────────────
  console.log('\n  ▸ Category assignments')
  await Promise.all([
    rb.categories.assignProduct(pTshirt.id, catTops.id),
    rb.categories.assignProduct(pTshirt.id, catClothing.id),
    rb.categories.assignProduct(pChinos.id, catBottoms.id),
    rb.categories.assignProduct(pChinos.id, catClothing.id),
    rb.categories.assignProduct(pEarbuds.id, catElec.id),
    rb.categories.assignProduct(pHub.id, catElec.id),
    rb.categories.assignProduct(pBottle.id, catAccess.id),
    rb.categories.assignProduct(pTote.id, catAccess.id),
    rb.categories.assignProduct(pBeanie.id, catClothing.id),
    rb.categories.assignProduct(pWallet.id, catAccess.id),
    rb.categories.assignProduct(pEbook.id, catAccess.id),
  ])
  log('11 assignments done')

  // ── 7. Related products ────────────────────────────────────────────────────
  console.log('\n  ▸ Related products')
  await Promise.all([
    rb.catalog.addRelation(pTshirt.id, pChinos.id, 'cross_sell'),
    rb.catalog.addRelation(pTshirt.id, pBeanie.id, 'related'),
    rb.catalog.addRelation(pChinos.id, pTshirt.id, 'cross_sell'),
    rb.catalog.addRelation(pChinos.id, pWallet.id, 'related'),
    rb.catalog.addRelation(pEarbuds.id, pHub.id, 'upsell'),
    rb.catalog.addRelation(pHub.id, pEarbuds.id, 'related'),
    rb.catalog.addRelation(pBottle.id, pTote.id, 'related'),
    rb.catalog.addRelation(pTote.id, pBottle.id, 'related'),
    rb.catalog.addRelation(pTote.id, pEbook.id, 'cross_sell'),
    rb.catalog.addRelation(pWallet.id, pTshirt.id, 'related'),
  ])
  log('10 relations (related / upsell / cross-sell)')

  // ── 8. CMS pages ──────────────────────────────────────────────────────────
  console.log('\n  ▸ CMS pages')
  await Promise.all([
    rb.cms.create({
      slug: 'about',
      title: 'About Us',
      content: `# About Redbird Demo Store\n\nWe are a curated marketplace for sustainable and beautifully crafted products.\n\n## Our mission\n\nMaking it easy for conscious consumers to find products made by brands that care about people and the planet.\n\n## Contact\n\nhello@redbird-demo.com`,
      published: true,
      position: 1,
    }),
    rb.cms.create({
      slug: 'faq',
      title: 'FAQ',
      content: `# Frequently Asked Questions\n\n## Shipping\n\n**How long does delivery take?**\nStandard: 3–5 business days. Express: 1–2 days.\n\n**Do you ship internationally?**\nYes, to 40+ countries (7–14 business days).\n\n## Returns\n\n**What is your return policy?**\nFull refund within 30 days, items unused in original packaging.\n\n## Payments\n\nWe accept all major credit cards, PayPal, and gift cards.`,
      published: true,
      position: 2,
    }),
    rb.cms.create({
      slug: 'sustainability',
      title: 'Our Sustainability Pledge',
      content: `# Our Sustainability Pledge\n\nEvery product we sell is chosen for its environmental and social impact.\n\n- 🌱 Carbon-neutral shipping\n- ♻️ Recycled packaging on all orders\n- 🤝 Fair trade certified suppliers`,
      published: true,
      position: 3,
    }),
  ])
  log('3 pages (About, FAQ, Sustainability)')

  // ── 9. Promo codes ─────────────────────────────────────────────────────────
  console.log('\n  ▸ Promo codes')
  await Promise.all([
    rb.promos.create({ code: 'WELCOME10', type: 'percentage', value: 10 }),
    rb.promos.create({ code: 'SAVE20', type: 'fixed', value: eur(20), currency: 'EUR', minimumAmount: eur(100) }),
    rb.promos.create({ code: 'ECO15', type: 'percentage', value: 15, maxUses: 50 }),
  ])
  log('WELCOME10 (10%) · SAVE20 (€20 off ≥€100) · ECO15 (15%, 50 uses)')

  // ── 10. Gift cards ─────────────────────────────────────────────────────────
  console.log('\n  ▸ Gift cards')
  await Promise.all([
    rb.giftCards.create({ balance: eur(50), currency: 'EUR', code: 'DEMO-GIFT-50EU' }),
    rb.giftCards.create({ balance: eur(100), currency: 'EUR', code: 'DEMO-GIFT-100E' }),
    rb.giftCards.create({
      balance: eur(25),
      currency: 'EUR',
      code: 'DEMO-XMAS-2024',
      expiresAt: new Date('2025-01-31'),
    }),
  ])
  log('DEMO-GIFT-50EU (€50) · DEMO-GIFT-100E (€100) · DEMO-XMAS-2024 (expired)')

  // ── 11. Customers ──────────────────────────────────────────────────────────
  console.log('\n  ▸ Customers')
  const alice = await rb.customers.register({ email: 'alice@example.com', password: 'password123', firstName: 'Alice', lastName: 'Martin' })
  const bob = await rb.customers.register({ email: 'bob@example.com', password: 'password123', firstName: 'Bob', lastName: 'Dupont' })
  log('alice@example.com · bob@example.com  (password: password123)')

  // ── 12. Orders ─────────────────────────────────────────────────────────────
  console.log('\n  ▸ Orders')

  const aliceAddr = { firstName: 'Alice', lastName: 'Martin', line1: '12 rue de la Paix', city: 'Paris', postalCode: '75001', countryCode: 'FR' }
  const bobAddr = { firstName: 'Bob', lastName: 'Dupont', line1: '8 avenue Victor Hugo', city: 'Lyon', postalCode: '69002', countryCode: 'FR' }

  // Order 1: Alice — fulfilled (earbuds + tote)
  {
    const cartId = (await rb.cart.create({ currency: 'EUR', customerId: alice.id })).id
    if (fEarbuds?.variants[0]) await rb.cart.addItem(cartId, fEarbuds.variants[0].id, 1)
    if (fTote?.variants[0]) await rb.cart.addItem(cartId, fTote.variants[0].id, 2)
    const o = await rb.orders.createFromCart(cartId, { customerEmail: alice.email, shippingAddress: aliceAddr, shippingAmount: 0 })
    await rb.orders.markPaid(o.id)
    await rb.orders.markFulfilled(o.id)
    await rb.orders.setTracking(o.id, 'FR123456789', 'https://www.laposte.fr/outils/suivre-vos-envois?code=FR123456789')
    log('Order #1 fulfilled', `Alice · Earbuds + Tote`)
  }

  // Order 2: Alice — paid with promo (t-shirt M + beanie)
  {
    const cartId = (await rb.cart.create({ currency: 'EUR', customerId: alice.id })).id
    const tshirtM = fTshirt?.variants[1]
    const beanie = fBeanie?.variants[0]
    if (tshirtM) await rb.cart.addItem(cartId, tshirtM.id, 1)
    if (beanie) await rb.cart.addItem(cartId, beanie.id, 1)
    const subtotal = (tshirtM?.priceAmount ?? 0) + (beanie?.priceAmount ?? 0)
    const discount = Math.round(subtotal * 0.1)
    const o = await rb.orders.createFromCart(cartId, {
      customerEmail: alice.email,
      shippingAddress: aliceAddr,
      shippingAmount: 0,
      promoCode: 'WELCOME10',
      discountAmount: discount,
    })
    await rb.orders.markPaid(o.id)
    log('Order #2 paid', `Alice · T-shirt + Beanie · WELCOME10 applied`)
  }

  // Order 3: Bob — pending (hub + bottle ×2)
  {
    const cartId = (await rb.cart.create({ currency: 'EUR', customerId: bob.id })).id
    if (fHub?.variants[0]) await rb.cart.addItem(cartId, fHub.variants[0].id, 1)
    if (fBottle?.variants[0]) await rb.cart.addItem(cartId, fBottle.variants[0].id, 2)
    await rb.orders.createFromCart(cartId, { customerEmail: bob.email, shippingAddress: bobAddr, shippingAmount: eur(4.9) })
    log('Order #3 pending', `Bob · Hub + Bottle ×2`)
  }

  // Order 4: Alice — cancelled (wallet)
  {
    const cartId = (await rb.cart.create({ currency: 'EUR', customerId: alice.id })).id
    if (fWallet?.variants[0]) await rb.cart.addItem(cartId, fWallet.variants[0].id, 1)
    const o = await rb.orders.createFromCart(cartId, { customerEmail: alice.email, shippingAddress: aliceAddr })
    await rb.orders.cancel(o.id)
    log('Order #4 cancelled', `Alice · Wallet`)
  }

  // ── 13. Reviews ────────────────────────────────────────────────────────────
  console.log('\n  ▸ Reviews')
  const reviewsToApprove = await Promise.all([
    rb.reviews.create({ productId: pEarbuds.id, customerId: alice.id, customerName: 'Alice M.', rating: 5, comment: 'Incredible sound quality and the ANC is superb. Battery life matches the specs. Already recommended to 3 friends!' }),
    rb.reviews.create({ productId: pEarbuds.id, customerName: 'Thomas R.', rating: 4, comment: 'Great earbuds overall. Sound is crisp, fit is comfortable. The companion app could be better.' }),
    rb.reviews.create({ productId: pTshirt.id, customerId: alice.id, customerName: 'Alice M.', rating: 5, comment: 'Incredibly soft and breathable. Sizing is spot on. Already ordered a second one in Large!' }),
    rb.reviews.create({ productId: pBottle.id, customerName: 'Léa K.', rating: 4, comment: 'Keeps drinks cold all day even in summer. Love the bamboo texture. Lid could be slightly easier to open.' }),
    rb.reviews.create({ productId: pHub.id, customerName: 'Marcus P.', rating: 5, comment: 'Works flawlessly with my MacBook. All 7 ports active simultaneously, no lag. 100W passthrough is a game changer.' }),
    rb.reviews.create({ productId: pTote.id, customerName: 'Sophie D.', rating: 5, comment: 'Sturdy, good-looking and guilt-free. The zip pocket inside is a great addition. Daily driver now.' }),
  ])
  await Promise.all(reviewsToApprove.map((r) => rb.reviews.approve(r.id)))
  log('6 reviews (all approved)')

  // ── 14. Loyalty ────────────────────────────────────────────────────────────
  console.log('\n  ▸ Loyalty')
  await rb.loyalty.adjust(alice.id, 128, 'Welcome bonus — demo seed')
  log('Alice: 128 loyalty points')

  // ── Done ───────────────────────────────────────────────────────────────────
  await rb.close()

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  ✅  Redbird demo data seeded successfully               ║
╠══════════════════════════════════════════════════════════╣
║  Brands        3 (Artisan Co. · TechWave · EcoVerde)    ║
║  Categories    5 (incl. Tops / Bottoms subcategories)   ║
║  Products      9 active · 1 draft                       ║
║  Stock         set on all active variants                ║
║  CMS pages     3 (About · FAQ · Sustainability)          ║
║  Promos        WELCOME10 · SAVE20 · ECO15                ║
║  Gift cards    DEMO-GIFT-50EU · DEMO-GIFT-100E           ║
║  Customers     alice@example.com · bob@example.com       ║
║                (password: password123)                   ║
║  Orders        4 (fulfilled · paid · pending · cancelled)║
║  Reviews       6 (all approved)                         ║
║  Loyalty       Alice has ~128 pts                       ║
╚══════════════════════════════════════════════════════════╝

  Run \`pnpm dev\` to start the dev server.
`)
}

main().catch((err) => {
  const msg = err instanceof Error
    ? (err.message || err.stack || String(err))
    : JSON.stringify(err, null, 2)
  console.error('\n✗  Seed failed:', msg)
  process.exit(1)
})
