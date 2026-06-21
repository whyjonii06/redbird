import { createHash } from 'node:crypto'
import type { RelayPoint, ShippingProvider } from '@redbirdshop/core'
import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'

/**
 * Mondial Relay — relay-point (Point Relais) delivery for France/Benelux.
 *
 * A shipping plugin: it provides a flat delivery rate AND the `searchRelayPoints`
 * capability (WSI4 SOAP web service `WSI4_PointRelais_Recherche`). Installable
 * and configurable from the Marketplace; bring your own merchant credentials.
 */

const WSI4_ENDPOINT = 'https://api.mondialrelay.com/Web_Services.asmx'
const WSI4_ACTION = 'http://www.mondialrelay.fr/webservice/WSI4_PointRelais_Recherche'

const ConfigSchema = z.object({
  /** Mondial Relay brand/enseigne code (8 chars). */
  enseigne: z.string().min(1),
  /** Private key used to sign requests. */
  privateKey: z.string().min(1),
  /** Flat rate for relay-point delivery, in cents (accepts a numeric string). */
  rateAmount: z.coerce.number().int().min(0).default(490),
  rateCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('EUR'),
})

export type MondialRelayConfig = z.input<typeof ConfigSchema>

/** WSI4 security hash: uppercase MD5 of all values concatenated + private key. */
export function computeSignature(values: string[], privateKey: string): string {
  return createHash('md5')
    .update(values.join('') + privateKey, 'latin1')
    .digest('hex')
    .toUpperCase()
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildSearchEnvelope(
  creds: { enseigne: string; privateKey: string },
  input: { countryCode: string; postalCode: string; count?: number },
): string {
  const fields = {
    Enseigne: creds.enseigne,
    Pays: input.countryCode.toUpperCase(),
    Ville: '',
    CP: input.postalCode,
    Latitude: '',
    Longitude: '',
    Taille: '',
    Poids: '',
    Action: '',
    DelaiEnvoi: '0',
    RayonRecherche: '',
    TypeActivite: '',
    NombreResultats: String(input.count ?? 10),
  }
  const security = computeSignature(Object.values(fields), creds.privateKey)
  const body = Object.entries(fields)
    .map(([k, v]) => `<${k}>${esc(v)}</${k}>`)
    .join('')
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI4_PointRelais_Recherche xmlns="http://www.mondialrelay.fr/webservice/">
      ${body}
      <Security>${security}</Security>
    </WSI4_PointRelais_Recherche>
  </soap:Body>
</soap:Envelope>`
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)
  return m ? m[1]!.trim() : ''
}

export function parseSearchResponse(xml: string): { stat: string; points: RelayPoint[] } {
  const stat = tag(xml, 'STAT') || tag(xml, 'Stat')
  const points: RelayPoint[] = []
  const blocks = xml.match(/<PointRelais_Details>[\s\S]*?<\/PointRelais_Details>/g) ?? []
  for (const b of blocks) {
    const lat = Number.parseFloat(tag(b, 'Latitude').replace(',', '.'))
    const lng = Number.parseFloat(tag(b, 'Longitude').replace(',', '.'))
    points.push({
      id: tag(b, 'Num'),
      name: tag(b, 'LgAdr1'),
      street: [tag(b, 'LgAdr3'), tag(b, 'LgAdr4')].filter(Boolean).join(' '),
      postalCode: tag(b, 'CP'),
      city: tag(b, 'Ville'),
      countryCode: tag(b, 'Pays'),
      ...(Number.isFinite(lat) ? { latitude: lat } : {}),
      ...(Number.isFinite(lng) ? { longitude: lng } : {}),
    })
  }
  return { stat: stat || '0', points }
}

export function shippingMondialRelay(input: MondialRelayConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  const calculate: ShippingProvider['calculate'] = (_country, _subtotal, _weight, _currency) => ({
    zone: 'Mondial Relay',
    amount: config.rateAmount ?? 490,
    currency: config.rateCurrency ?? 'EUR',
    free: false,
  })

  const searchRelayPoints: NonNullable<ShippingProvider['searchRelayPoints']> = async (search) => {
    const envelope = buildSearchEnvelope(
      { enseigne: config.enseigne, privateKey: config.privateKey },
      search,
    )
    const res = await fetch(WSI4_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: WSI4_ACTION },
      body: envelope,
    })
    const { stat, points } = parseSearchResponse(await res.text())
    if (stat !== '0') throw new Error(`Mondial Relay error (STAT ${stat})`)
    return points
  }

  return Object.assign(
    definePlugin({ name: '@redbird/plugin-shipping-mondial-relay', version: '0.0.0' }),
    { config, calculate, searchRelayPoints },
  )
}
