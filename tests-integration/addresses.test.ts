import { type Address, createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Shipping addresses (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  const sampleAddress: Address = {
    firstName: 'Alice',
    lastName: 'Dupont',
    line1: '12 rue de la Paix',
    city: 'Paris',
    postalCode: '75001',
    countryCode: 'FR',
  }

  async function seedCart() {
    await redbird.catalog.createProduct({ slug: 'shirt', name: 'Cotton Shirt', status: 'active' }, [
      { sku: 'SHIRT-M', name: 'Medium', priceAmount: 2990, priceCurrency: 'EUR' },
    ])
    const p = await redbird.catalog.getProductBySlug('shirt')
    const variant = p?.variants[0]!
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variant.id, 1)
    return cart
  }

  it('stores a shipping address on the cart', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    const updated = await redbird.cart.setShippingAddress(cart.id, sampleAddress)

    expect(updated.shippingAddress).toMatchObject({
      firstName: 'Alice',
      lastName: 'Dupont',
      line1: '12 rue de la Paix',
      city: 'Paris',
      postalCode: '75001',
      countryCode: 'FR',
    })
  })

  it('persists the address when the cart is re-fetched', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.setShippingAddress(cart.id, sampleAddress)

    const fetched = await redbird.cart.get(cart.id)
    expect(fetched?.shippingAddress?.city).toBe('Paris')
  })

  it('overwrites a previous address', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.setShippingAddress(cart.id, sampleAddress)
    const newAddress: Address = { ...sampleAddress, city: 'Lyon', postalCode: '69001' }
    await redbird.cart.setShippingAddress(cart.id, newAddress)

    const fetched = await redbird.cart.get(cart.id)
    expect(fetched?.shippingAddress?.city).toBe('Lyon')
  })

  it('stores optional line2 and phone', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    const address: Address = {
      ...sampleAddress,
      line2: 'Apt 4B',
      phone: '+33 6 12 34 56 78',
    }
    await redbird.cart.setShippingAddress(cart.id, address)

    const fetched = await redbird.cart.get(cart.id)
    expect(fetched?.shippingAddress?.line2).toBe('Apt 4B')
    expect(fetched?.shippingAddress?.phone).toBe('+33 6 12 34 56 78')
  })

  it('propagates cart address to order when no address passed to createFromCart', async () => {
    const cart = await seedCart()
    await redbird.cart.setShippingAddress(cart.id, sampleAddress)

    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'alice@example.com',
    })

    expect(order.shippingAddress).toMatchObject({
      firstName: 'Alice',
      city: 'Paris',
      countryCode: 'FR',
    })
  })

  it('uses the address passed to createFromCart over the cart address', async () => {
    const cart = await seedCart()
    await redbird.cart.setShippingAddress(cart.id, sampleAddress)

    const overrideAddress: Address = {
      firstName: 'Bob',
      lastName: 'Martin',
      line1: '5 avenue Victor Hugo',
      city: 'Bordeaux',
      postalCode: '33000',
      countryCode: 'FR',
    }
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'bob@example.com',
      shippingAddress: overrideAddress,
    })

    expect(order.shippingAddress?.firstName).toBe('Bob')
    expect(order.shippingAddress?.city).toBe('Bordeaux')
  })

  it('creates an order with null address when neither cart nor input has one', async () => {
    const cart = await seedCart()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'anon@example.com',
    })

    expect(order.shippingAddress).toBeNull()
  })

  it('throws when setting address on a non-existent cart', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    await expect(redbird.cart.setShippingAddress(fakeId, sampleAddress)).rejects.toThrow(
      /not found/,
    )
  })
})
