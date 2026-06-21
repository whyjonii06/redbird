import { EU_COUNTRY_CODES } from './rates.js'

export type ViesResult = {
  valid: boolean
  countryCode?: string | undefined
  vatNumber?: string | undefined
  name?: string | undefined
  address?: string | undefined
}

const VIES_ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService'

function buildSoapEnvelope(countryCode: string, vatNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soap:Body>
    <tns:checkVat>
      <tns:countryCode>${countryCode}</tns:countryCode>
      <tns:vatNumber>${vatNumber}</tns:vatNumber>
    </tns:checkVat>
  </soap:Body>
</soap:Envelope>`
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`).exec(xml)
  return match?.[1]?.trim() || undefined
}

/** Format: 2-letter country code + digits/letters. E.g. FR12345678901 */
const VAT_PATTERN = /^[A-Z]{2}[0-9A-Z+*]{2,12}$/

export function parseVatNumber(vatNumber: string): { countryCode: string; number: string } | null {
  const cleaned = vatNumber.replace(/[\s\-.]/g, '').toUpperCase()
  if (!VAT_PATTERN.test(cleaned)) return null
  const countryCode = cleaned.slice(0, 2)
  if (!EU_COUNTRY_CODES.has(countryCode)) return null
  return { countryCode, number: cleaned.slice(2) }
}

export async function validateVatNumberVies(
  vatNumber: string,
  opts: { dryRun?: boolean | undefined } = {},
): Promise<ViesResult> {
  const parsed = parseVatNumber(vatNumber)
  if (!parsed) return { valid: false }

  if (opts.dryRun) {
    return { valid: true, countryCode: parsed.countryCode, vatNumber: parsed.number }
  }

  const res = await fetch(VIES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    body: buildSoapEnvelope(parsed.countryCode, parsed.number),
  })

  if (!res.ok) throw new Error(`VIES API error ${res.status}`)

  const xml = await res.text()
  const valid = extractTag(xml, 'valid') === 'true'

  return {
    valid,
    countryCode: parsed.countryCode,
    vatNumber: parsed.number,
    name: extractTag(xml, 'name'),
    address: extractTag(xml, 'address'),
  }
}
