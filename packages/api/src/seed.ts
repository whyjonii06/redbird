import type { Redbird } from '@redbirdshop/core'

export async function seedDemoData(redbird: Redbird, currency: string): Promise<void> {
  console.log('  → Seeding demo data…')

  // Brands
  const [techCorp, styleWear] = await Promise.all([
    redbird.brands.create({ name: 'TechCorp', slug: 'techcorp', description: 'Consumer electronics' }),
    redbird.brands.create({ name: 'StyleWear', slug: 'stylewear', description: 'Modern lifestyle clothing' }),
  ])

  // Categories
  const electronics = await redbird.categories.create({ name: 'Electronics', slug: 'electronics' })
  const clothing = await redbird.categories.create({ name: 'Clothing', slug: 'clothing' })
  const mens = await redbird.categories.create({ name: "Men's", slug: 'mens', parentId: clothing.id })

  // Products
  const headphones = await redbird.catalog.createProduct(
    {
      name: 'Wireless Headphones',
      slug: 'wireless-headphones',
      status: 'active',
      description: 'Noise-cancelling over-ear headphones, 30h battery.',
      brandId: techCorp.id,
    },
    [
      { sku: 'HDPH-BLK', name: 'Black', priceAmount: 8990, priceCurrency: currency },
      { sku: 'HDPH-WHT', name: 'White', priceAmount: 8990, priceCurrency: currency },
    ],
  )

  const keyboard = await redbird.catalog.createProduct(
    {
      name: 'Mechanical Keyboard',
      slug: 'mechanical-keyboard',
      status: 'active',
      description: 'TKL mechanical keyboard with Cherry MX switches.',
      brandId: techCorp.id,
    },
    [{ sku: 'KB-TKL-SGR', name: 'Space Gray', priceAmount: 12990, priceCurrency: currency }],
  )

  const smartWatch = await redbird.catalog.createProduct(
    {
      name: 'Smart Watch',
      slug: 'smart-watch',
      status: 'active',
      description: 'Health tracking smartwatch with AMOLED display.',
      brandId: techCorp.id,
    },
    [
      { sku: 'SW-BLK-42', name: '42mm Black', priceAmount: 19990, priceCurrency: currency },
      { sku: 'SW-SLV-42', name: '42mm Silver', priceAmount: 19990, priceCurrency: currency },
    ],
  )

  const tshirt = await redbird.catalog.createProduct(
    {
      name: 'Essential T-Shirt',
      slug: 'essential-t-shirt',
      status: 'active',
      description: '100% organic cotton classic fit.',
      brandId: styleWear.id,
    },
    [
      { sku: 'TSH-WHT-S', name: 'White / S', priceAmount: 2990, priceCurrency: currency },
      { sku: 'TSH-WHT-M', name: 'White / M', priceAmount: 2990, priceCurrency: currency },
      { sku: 'TSH-WHT-L', name: 'White / L', priceAmount: 2990, priceCurrency: currency },
      { sku: 'TSH-BLK-M', name: 'Black / M', priceAmount: 2990, priceCurrency: currency },
    ],
  )

  const shoes = await redbird.catalog.createProduct(
    {
      name: 'Running Shoes',
      slug: 'running-shoes',
      status: 'active',
      description: 'Lightweight road running shoes with cushioned sole.',
      brandId: styleWear.id,
    },
    [
      { sku: 'RUN-WHT-41', name: 'White / EU 41', priceAmount: 8990, priceCurrency: currency },
      { sku: 'RUN-WHT-43', name: 'White / EU 43', priceAmount: 8990, priceCurrency: currency },
      { sku: 'RUN-BLK-42', name: 'Black / EU 42', priceAmount: 8990, priceCurrency: currency },
    ],
  )

  // Product images
  await Promise.all([
    redbird.images.add(headphones.id, { url: 'https://images.unsplash.com/photo-1547932087-59a8f2be576e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Wireless Headphones', position: 0 }),
    redbird.images.add(headphones.id, { url: 'https://images.unsplash.com/photo-1599669454699-248893623440?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Wireless Headphones side view', position: 1 }),
    redbird.images.add(keyboard.id, { url: 'https://images.unsplash.com/photo-1558050032-8e05d4037d2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Mechanical Keyboard', position: 0 }),
    redbird.images.add(keyboard.id, { url: 'https://images.unsplash.com/photo-1697022976761-67a1b0955cff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Mechanical Keyboard detail', position: 1 }),
    redbird.images.add(smartWatch.id, { url: 'https://images.unsplash.com/photo-1523501634414-d5b1b9f092e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Smart Watch', position: 0 }),
    redbird.images.add(smartWatch.id, { url: 'https://images.unsplash.com/photo-1610820270236-3118408a09c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Smart Watch on wrist', position: 1 }),
    redbird.images.add(tshirt.id, { url: 'https://images.unsplash.com/photo-1591280011281-7f86a0156682?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Essential T-Shirt', position: 0 }),
    redbird.images.add(tshirt.id, { url: 'https://images.unsplash.com/photo-1661181475147-bbd20ef65781?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Essential T-Shirt worn', position: 1 }),
    redbird.images.add(shoes.id, { url: 'https://images.unsplash.com/photo-1693751193112-667e035fedb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Running Shoes', position: 0 }),
    redbird.images.add(shoes.id, { url: 'https://images.unsplash.com/photo-1774280246516-5a817f172a39?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', alt: 'Running Shoes side view', position: 1 }),
  ])

  // Assign products to categories
  await Promise.all([
    redbird.categories.assignProduct(headphones.id, electronics.id),
    redbird.categories.assignProduct(keyboard.id, electronics.id),
    redbird.categories.assignProduct(smartWatch.id, electronics.id),
    redbird.categories.assignProduct(tshirt.id, clothing.id),
    redbird.categories.assignProduct(tshirt.id, mens.id),
    redbird.categories.assignProduct(shoes.id, clothing.id),
    redbird.categories.assignProduct(shoes.id, mens.id),
  ])

  // Fetch product details to get variant IDs for stock + orders
  const [hpFull, kbFull, swFull, tsFull, rnFull] = await Promise.all([
    redbird.catalog.getProductById(headphones.id),
    redbird.catalog.getProductById(keyboard.id),
    redbird.catalog.getProductById(smartWatch.id),
    redbird.catalog.getProductById(tshirt.id),
    redbird.catalog.getProductById(shoes.id),
  ])

  // Set stock
  const electronicsVariants = [hpFull, kbFull, swFull].flatMap((p) => p?.variants ?? [])
  const clothingVariants = [tsFull, rnFull].flatMap((p) => p?.variants ?? [])
  await Promise.all([
    ...electronicsVariants.map((v) => redbird.stock.set(v.id, 25)),
    ...clothingVariants.map((v) => redbird.stock.set(v.id, 50)),
  ])

  // Customers
  const [jean, marie] = await Promise.all([
    redbird.customers.register({
      email: 'jean.dupont@example.com',
      password: 'Demo1234!',
      firstName: 'Jean',
      lastName: 'Dupont',
    }),
    redbird.customers.register({
      email: 'marie.martin@example.com',
      password: 'Demo1234!',
      firstName: 'Marie',
      lastName: 'Martin',
    }),
    redbird.customers.register({
      email: 'pierre.bernard@example.com',
      password: 'Demo1234!',
      firstName: 'Pierre',
      lastName: 'Bernard',
    }),
  ])

  // Orders
  const hpVar = hpFull?.variants[0]
  const tsVar = tsFull?.variants[1]
  const swVar = swFull?.variants[0]

  if (hpVar && tsVar) {
    const cart1 = await redbird.cart.create({ currency, customerId: jean.id })
    await redbird.cart.addItem(cart1.id, hpVar.id, 1)
    await redbird.cart.addItem(cart1.id, tsVar.id, 2)
    const order1 = await redbird.orders.createFromCart(cart1.id, {
      customerEmail: jean.email,
      shippingAddress: {
        firstName: 'Jean',
        lastName: 'Dupont',
        line1: '12 Rue de la Paix',
        city: 'Paris',
        postalCode: '75001',
        countryCode: 'FR',
      },
    })
    await redbird.orders.markPaid(order1.id)
  }

  if (swVar) {
    const cart2 = await redbird.cart.create({ currency, customerId: marie.id })
    await redbird.cart.addItem(cart2.id, swVar.id, 1)
    await redbird.orders.createFromCart(cart2.id, {
      customerEmail: marie.email,
      shippingAddress: {
        firstName: 'Marie',
        lastName: 'Martin',
        line1: '5 Av. des Champs-Élysées',
        city: 'Paris',
        postalCode: '75008',
        countryCode: 'FR',
      },
    })
  }

  console.log('  ✓ Demo data seeded (2 brands, 3 categories, 5 products, 3 customers, 2 orders)')
}
