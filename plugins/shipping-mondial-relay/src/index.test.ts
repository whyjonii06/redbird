import { describe, expect, it } from 'vitest'
import {
  buildSearchEnvelope,
  computeSignature,
  parseSearchResponse,
  shippingMondialRelay,
} from './index.js'

describe('Mondial Relay plugin', () => {
  it('computes an uppercase 32-char MD5 security hash, deterministically', () => {
    const sig = computeSignature(['BDTEST13', 'FR', '', '06000'], 'PrivateK')
    expect(sig).toMatch(/^[0-9A-F]{32}$/)
    expect(sig).toBe(computeSignature(['BDTEST13', 'FR', '', '06000'], 'PrivateK'))
    expect(sig).not.toBe(computeSignature(['BDTEST13', 'FR', '', '06000'], 'other'))
  })

  it('builds a SOAP envelope with the query fields and a Security hash', () => {
    const env = buildSearchEnvelope(
      { enseigne: 'BDTEST13', privateKey: 'PrivateK' },
      { countryCode: 'fr', postalCode: '06000', count: 7 },
    )
    expect(env).toContain('<Enseigne>BDTEST13</Enseigne>')
    expect(env).toContain('<Pays>FR</Pays>')
    expect(env).toContain('<CP>06000</CP>')
    expect(env).toContain('<NombreResultats>7</NombreResultats>')
    expect(env).toMatch(/<Security>[0-9A-F]{32}<\/Security>/)
  })

  it('parses relay points from a WSI4 response', () => {
    const xml = `<STAT>0</STAT>
      <PointRelais_Details><Num>012345</Num><LgAdr1>SUPERETTE</LgAdr1><LgAdr3>12 RUE DU TEST</LgAdr3><CP>06000</CP><Ville>NICE</Ville><Pays>FR</Pays><Latitude>43,7</Latitude><Longitude>7,26</Longitude></PointRelais_Details>`
    const { stat, points } = parseSearchResponse(xml)
    expect(stat).toBe('0')
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ id: '012345', city: 'NICE', countryCode: 'FR', latitude: 43.7 })
  })

  it('exposes a shipping provider with a relay rate and searchRelayPoints', () => {
    const plugin = shippingMondialRelay({ enseigne: 'BDTEST13', privateKey: 'PrivateK', rateAmount: 490 })
    expect(plugin.name).toBe('@redbird/plugin-shipping-mondial-relay')
    expect(plugin.calculate('FR', 1000, 0, 'EUR')).toMatchObject({ amount: 490, currency: 'EUR' })
    expect(typeof plugin.searchRelayPoints).toBe('function')
  })
})
