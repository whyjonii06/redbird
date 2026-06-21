import type { OrderWithItems, SellerConfig } from '@redbirdshop/core'
import { describe, expect, it } from 'vitest'
import { facturXFromOrder, generateFacturXForOrder, generateFacturXPdf } from './invoice.js'

const seller: SellerConfig = {
  name: 'Redbird Café SAS',
  address: { line1: '12 rue du Commerce', postalCode: '06000', city: 'Nice', countryCode: 'FR' },
  vatNumber: 'FR12345678901',
  legalRegistrationId: '123456789',
}

const order = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 'RB-20260620-AB12',
  customerId: null,
  customerEmail: 'jean@example.com',
  status: 'paid',
  currency: 'EUR',
  subtotalAmount: 2000,
  shippingAmount: 0,
  taxAmount: 400,
  discountAmount: 0,
  promoCode: null,
  totalAmount: 2400,
  notes: null,
  trackingNumber: null,
  trackingUrl: null,
  shippingAddress: {
    firstName: 'Jean',
    lastName: 'Dupont',
    line1: '5 av. des Fleurs',
    city: 'Nice',
    postalCode: '06000',
    countryCode: 'FR',
  },
  refundedAmount: 0,
  invoiceNumber: '2026-000001',
  invoicedAt: new Date(Date.UTC(2026, 5, 20)),
  createdAt: new Date(Date.UTC(2026, 5, 20)),
  updatedAt: new Date(Date.UTC(2026, 5, 20)),
  lineItems: [
    {
      id: 'li-1',
      orderId: '00000000-0000-0000-0000-000000000001',
      variantId: null,
      productName: 'Café Éthiopie',
      variantName: '250g',
      sku: 'COF-250',
      quantity: 2,
      unitPriceAmount: 1000,
      unitPriceCurrency: 'EUR',
      totalAmount: 2000,
    },
  ],
} as unknown as OrderWithItems

describe('facturXFromOrder — multi-rate VAT', () => {
  const multi = {
    ...order,
    subtotalAmount: 3000,
    shippingAmount: 0,
    discountAmount: 0,
    taxAmount: 455, // 20% on 2000 + 5.5% on 1000
    totalAmount: 3455,
    lineItems: [
      { ...order.lineItems[0], totalAmount: 2000, quantity: 2, unitPriceAmount: 1000, taxRateBp: 2000 },
      {
        id: 'li-2',
        orderId: order.id,
        variantId: null,
        productName: 'Livre',
        variantName: 'broché',
        sku: 'BK-1',
        quantity: 1,
        unitPriceAmount: 1000,
        unitPriceCurrency: 'EUR',
        totalAmount: 1000,
        taxRateBp: 550,
      },
    ],
  } as unknown as Parameters<typeof facturXFromOrder>[0]

  it('produces one VAT breakdown group per rate, reconciled to the charged tax', () => {
    const input = facturXFromOrder(multi, seller, '2026-000050')
    expect(input.vatBreakdown).toHaveLength(2)
    const std = input.vatBreakdown.find((v) => v.ratePercent === 20)
    const reduced = input.vatBreakdown.find((v) => v.ratePercent === 5.5)
    expect(std).toMatchObject({ basisCents: 2000, taxCents: 400 })
    expect(reduced).toMatchObject({ basisCents: 1000, taxCents: 55 })
    // The breakdown sums to the actually charged amounts (legal consistency).
    expect(input.vatBreakdown.reduce((s, v) => s + v.taxCents, 0)).toBe(455)
    expect(input.vatBreakdown.reduce((s, v) => s + v.basisCents, 0)).toBe(3000)
    expect(input.lines.map((l) => l.vatRatePercent)).toEqual([20, 5.5])
  })

  it('renders both rates in the generated CII XML', () => {
    const xml = generateFacturXForOrder(multi, seller, '2026-000050')
    expect(xml).toContain('<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>')
    expect(xml).toContain('<ram:RateApplicablePercent>5.50</ram:RateApplicablePercent>')
  })
})

describe('generateFacturXPdf', () => {
  it('produces a PDF/A-3 with the factur-x.xml embedded as an associated file', async () => {
    const pdf = await generateFacturXPdf(order, seller, '2026-000001', 'Redbird Café')
    expect(pdf.length).toBeGreaterThan(1000)
    const s = pdf.toString('latin1')
    expect(s.startsWith('%PDF-1.7')).toBe(true)
    // Embedded Factur-X XML attachment
    expect(s).toContain('factur-x.xml')
    expect(s).toContain('AFRelationship')
    expect(s).toContain('EmbeddedFile')
    // PDF/A-3 identification + output intent added by pdfkit
    expect(s).toContain('pdfaid:part')
    expect(s).toContain('OutputIntent')
    // Factur-X XMP extension schema
    expect(s).toContain('fx:ConformanceLevel')
    // Embedded TrueType font program (no non-embedded standard fonts for PDF/A)
    expect(s).toContain('FontFile2')
  })
})
