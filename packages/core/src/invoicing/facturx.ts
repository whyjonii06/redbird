import type { SellerConfig } from '../config.js'

/**
 * Factur-X / ZUGFeRD invoice generation (CII — Cross Industry Invoice, EN 16931).
 *
 * Factur-X is the Franco-German hybrid e-invoice standard: a human-readable PDF
 * with a machine-readable XML payload embedded inside. This module produces the
 * XML payload (profile BASIC) — the legally meaningful, structured part.
 * Embedding it into a PDF/A-3 is handled separately (see the API invoice layer).
 *
 * France mandates structured e-invoicing (réforme 2024-2026); Factur-X is the
 * reference format. Keeping this dependency-free and fully typed is deliberate.
 */

/** Factur-X BASIC profile identifier (EN 16931 compliant subset with line items). */
export const FACTURX_BASIC_PROFILE =
  'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic'

export type FacturXParty = {
  name: string
  address?: {
    line1?: string
    line2?: string
    postalCode?: string
    city?: string
    countryCode?: string
  }
  email?: string
}

export type FacturXLine = {
  /** Product/line label (BT-153). */
  name: string
  /** Billed quantity (BT-129). */
  quantity: number
  /** Net unit price in cents (BT-146). */
  unitPriceCents: number
  /** Net line total in cents (BT-131). */
  lineTotalCents: number
  /** VAT rate percent applied to this line, e.g. 20 (BT-152). */
  vatRatePercent: number
}

export type FacturXVatLine = {
  /** Rate percent, e.g. 20 (BT-119). */
  ratePercent: number
  /** Taxable basis in cents (BT-116). */
  basisCents: number
  /** VAT amount in cents (BT-117). */
  taxCents: number
}

export type FacturXInput = {
  /** Sequential, gapless invoice number (BT-1). */
  invoiceNumber: string
  /** Invoice issue date (BT-2). */
  issueDate: Date
  /** ISO 4217 currency, e.g. 'EUR' (BT-5). */
  currency: string
  seller: SellerConfig
  buyer: FacturXParty
  lines: FacturXLine[]
  /** Sum of net line amounts in cents (BT-106). */
  lineTotalCents: number
  /** Total allowances (discounts) in cents (BT-107). */
  allowanceTotalCents?: number
  /** Total charges (e.g. shipping) in cents (BT-108). */
  chargeTotalCents?: number
  /** Total without VAT in cents (BT-109). */
  taxBasisTotalCents: number
  /** Total VAT in cents (BT-110). */
  taxTotalCents: number
  /** Total with VAT in cents (BT-112). */
  grandTotalCents: number
  /** Amount due for payment in cents (BT-115). */
  amountDueCents: number
  /** VAT breakdown per rate (BG-23). */
  vatBreakdown: FacturXVatLine[]
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Cents → fixed 2-decimal string (CII amounts). */
function amt(cents: number): string {
  return (cents / 100).toFixed(2)
}

function pct(rate: number): string {
  return rate.toFixed(2)
}

function dateString(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** VAT category code per UNTDID 5305: S=standard, Z=zero-rated, E=exempt. */
function categoryCode(ratePercent: number): string {
  return ratePercent > 0 ? 'S' : 'Z'
}

function partyAddressXml(addr: FacturXParty['address'] | SellerConfig['address']): string {
  if (!addr) return ''
  const lines: string[] = ['<ram:PostalTradeAddress>']
  if (addr.postalCode) lines.push(`<ram:PostcodeCode>${esc(addr.postalCode)}</ram:PostcodeCode>`)
  if (addr.line1) lines.push(`<ram:LineOne>${esc(addr.line1)}</ram:LineOne>`)
  if ('line2' in addr && addr.line2) lines.push(`<ram:LineTwo>${esc(addr.line2)}</ram:LineTwo>`)
  if (addr.city) lines.push(`<ram:CityName>${esc(addr.city)}</ram:CityName>`)
  if (addr.countryCode) lines.push(`<ram:CountryID>${esc(addr.countryCode)}</ram:CountryID>`)
  lines.push('</ram:PostalTradeAddress>')
  return lines.join('')
}

/** Generate the Factur-X (BASIC) CII XML payload for an invoice. */
export function generateFacturXXml(input: FacturXInput): string {
  const { seller, buyer, currency } = input

  const sellerRegXml = [
    seller.legalRegistrationId
      ? `<ram:SpecifiedLegalOrganization><ram:ID>${esc(seller.legalRegistrationId)}</ram:ID></ram:SpecifiedLegalOrganization>`
      : '',
  ].join('')

  const sellerTaxXml = seller.vatNumber
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(seller.vatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : ''

  const lineItemsXml = input.lines
    .map((line, i) =>
      [
        '<ram:IncludedSupplyChainTradeLineItem>',
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>`,
        `<ram:SpecifiedTradeProduct><ram:Name>${esc(line.name)}</ram:Name></ram:SpecifiedTradeProduct>`,
        '<ram:SpecifiedLineTradeAgreement>',
        `<ram:NetPriceProductTradePrice><ram:ChargeAmount>${amt(line.unitPriceCents)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>`,
        '</ram:SpecifiedLineTradeAgreement>',
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`,
        '<ram:SpecifiedLineTradeSettlement>',
        `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${categoryCode(line.vatRatePercent)}</ram:CategoryCode><ram:RateApplicablePercent>${pct(line.vatRatePercent)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`,
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amt(line.lineTotalCents)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>`,
        '</ram:SpecifiedLineTradeSettlement>',
        '</ram:IncludedSupplyChainTradeLineItem>',
      ].join(''),
    )
    .join('')

  const vatBreakdownXml = input.vatBreakdown
    .map((v) =>
      [
        '<ram:ApplicableTradeTax>',
        `<ram:CalculatedAmount>${amt(v.taxCents)}</ram:CalculatedAmount>`,
        '<ram:TypeCode>VAT</ram:TypeCode>',
        `<ram:BasisAmount>${amt(v.basisCents)}</ram:BasisAmount>`,
        `<ram:CategoryCode>${categoryCode(v.ratePercent)}</ram:CategoryCode>`,
        `<ram:RateApplicablePercent>${pct(v.ratePercent)}</ram:RateApplicablePercent>`,
        '</ram:ApplicableTradeTax>',
      ].join(''),
    )
    .join('')

  const summation = [
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    `<ram:LineTotalAmount>${amt(input.lineTotalCents)}</ram:LineTotalAmount>`,
    input.chargeTotalCents
      ? `<ram:ChargeTotalAmount>${amt(input.chargeTotalCents)}</ram:ChargeTotalAmount>`
      : '',
    input.allowanceTotalCents
      ? `<ram:AllowanceTotalAmount>${amt(input.allowanceTotalCents)}</ram:AllowanceTotalAmount>`
      : '',
    `<ram:TaxBasisTotalAmount>${amt(input.taxBasisTotalCents)}</ram:TaxBasisTotalAmount>`,
    `<ram:TaxTotalAmount currencyID="${esc(currency)}">${amt(input.taxTotalCents)}</ram:TaxTotalAmount>`,
    `<ram:GrandTotalAmount>${amt(input.grandTotalCents)}</ram:GrandTotalAmount>`,
    `<ram:DuePayableAmount>${amt(input.amountDueCents)}</ram:DuePayableAmount>`,
    '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
  ].join('')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rsm:CrossIndustryInvoice',
    ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
    ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
    ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
    '<rsm:ExchangedDocumentContext>',
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${FACTURX_BASIC_PROFILE}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>`,
    '</rsm:ExchangedDocumentContext>',
    '<rsm:ExchangedDocument>',
    `<ram:ID>${esc(input.invoiceNumber)}</ram:ID>`,
    '<ram:TypeCode>380</ram:TypeCode>',
    `<ram:IssueDateTime><udt:DateTimeString format="102">${dateString(input.issueDate)}</udt:DateTimeString></ram:IssueDateTime>`,
    '</rsm:ExchangedDocument>',
    '<rsm:SupplyChainTradeTransaction>',
    lineItemsXml,
    '<ram:ApplicableHeaderTradeAgreement>',
    '<ram:SellerTradeParty>',
    `<ram:Name>${esc(seller.name)}</ram:Name>`,
    sellerRegXml,
    partyAddressXml(seller.address),
    sellerTaxXml,
    '</ram:SellerTradeParty>',
    '<ram:BuyerTradeParty>',
    `<ram:Name>${esc(buyer.name)}</ram:Name>`,
    partyAddressXml(buyer.address),
    '</ram:BuyerTradeParty>',
    '</ram:ApplicableHeaderTradeAgreement>',
    '<ram:ApplicableHeaderTradeDelivery />',
    '<ram:ApplicableHeaderTradeSettlement>',
    `<ram:InvoiceCurrencyCode>${esc(currency)}</ram:InvoiceCurrencyCode>`,
    vatBreakdownXml,
    summation,
    '</ram:ApplicableHeaderTradeSettlement>',
    '</rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
  ].join('')
}
