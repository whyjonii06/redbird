import { describe, expect, it } from 'vitest'
import type { SellerConfig } from '../config.js'
import { FACTURX_BASIC_PROFILE, type FacturXInput, generateFacturXXml } from './facturx.js'

const seller: SellerConfig = {
  name: 'Redbird Café SAS',
  address: {
    line1: '12 rue du Commerce',
    postalCode: '06000',
    city: 'Nice',
    countryCode: 'FR',
  },
  vatNumber: 'FR12345678901',
  legalRegistrationId: '123456789',
}

function baseInput(overrides: Partial<FacturXInput> = {}): FacturXInput {
  return {
    invoiceNumber: '2026-000042',
    issueDate: new Date(Date.UTC(2026, 5, 20)),
    currency: 'EUR',
    seller,
    buyer: { name: 'Jean Dupont', email: 'jean@example.com' },
    lines: [
      { name: 'Café Éthiopie 250g', quantity: 2, unitPriceCents: 1000, lineTotalCents: 2000, vatRatePercent: 20 },
    ],
    lineTotalCents: 2000,
    taxBasisTotalCents: 2000,
    taxTotalCents: 400,
    grandTotalCents: 2400,
    amountDueCents: 2400,
    vatBreakdown: [{ ratePercent: 20, basisCents: 2000, taxCents: 400 }],
    ...overrides,
  }
}

describe('generateFacturXXml', () => {
  it('produces a CII document with the BASIC profile', () => {
    const xml = generateFacturXXml(baseInput())
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('rsm:CrossIndustryInvoice')
    expect(xml).toContain(FACTURX_BASIC_PROFILE)
  })

  it('includes the invoice number, date (format 102) and type code 380', () => {
    const xml = generateFacturXXml(baseInput())
    expect(xml).toContain('<ram:ID>2026-000042</ram:ID>')
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
    expect(xml).toContain('<udt:DateTimeString format="102">20260620</udt:DateTimeString>')
  })

  it('includes seller legal identity (name, VAT, registration)', () => {
    const xml = generateFacturXXml(baseInput())
    expect(xml).toContain('<ram:Name>Redbird Café SAS</ram:Name>')
    expect(xml).toContain('<ram:ID schemeID="VA">FR12345678901</ram:ID>')
    expect(xml).toContain('<ram:ID>123456789</ram:ID>')
    expect(xml).toContain('<ram:CountryID>FR</ram:CountryID>')
  })

  it('renders monetary totals with 2 decimals and currency', () => {
    const xml = generateFacturXXml(baseInput())
    expect(xml).toContain('<ram:TaxBasisTotalAmount>20.00</ram:TaxBasisTotalAmount>')
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">4.00</ram:TaxTotalAmount>')
    expect(xml).toContain('<ram:GrandTotalAmount>24.00</ram:GrandTotalAmount>')
    expect(xml).toContain('<ram:DuePayableAmount>24.00</ram:DuePayableAmount>')
  })

  it('emits a VAT breakdown with category S for standard rate', () => {
    const xml = generateFacturXXml(baseInput())
    expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>')
    expect(xml).toContain('<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>')
    expect(xml).toContain('<ram:CalculatedAmount>4.00</ram:CalculatedAmount>')
  })

  it('uses category Z for zero-rated lines', () => {
    const xml = generateFacturXXml(
      baseInput({
        lines: [{ name: 'Livre', quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500, vatRatePercent: 0 }],
        taxTotalCents: 0,
        grandTotalCents: 1500,
        amountDueCents: 1500,
        taxBasisTotalCents: 1500,
        lineTotalCents: 1500,
        vatBreakdown: [{ ratePercent: 0, basisCents: 1500, taxCents: 0 }],
      }),
    )
    expect(xml).toContain('<ram:CategoryCode>Z</ram:CategoryCode>')
  })

  it('escapes XML special characters in free-text fields', () => {
    const xml = generateFacturXXml(
      baseInput({ buyer: { name: 'Tom & Jerry <Ltd>' } }),
    )
    expect(xml).toContain('Tom &amp; Jerry &lt;Ltd&gt;')
    expect(xml).not.toContain('Tom & Jerry <Ltd>')
  })

  it('renders one line item per input line with its label and quantity', () => {
    const xml = generateFacturXXml(baseInput())
    expect(xml).toContain('<ram:Name>Café Éthiopie 250g</ram:Name>')
    expect(xml).toContain('<ram:BilledQuantity unitCode="C62">2</ram:BilledQuantity>')
    expect(xml).toContain('<ram:LineTotalAmount>20.00</ram:LineTotalAmount>')
  })
})
