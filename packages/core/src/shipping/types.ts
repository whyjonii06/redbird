export type ShippingRate = {
  readonly zone: string | null
  readonly amount: number
  readonly currency: string
  readonly free: boolean
  readonly reason?: string | undefined
}

/** A pickup/relay point (e.g. Mondial Relay Point Relais). */
export type RelayPoint = {
  readonly id: string
  readonly name: string
  readonly street: string
  readonly postalCode: string
  readonly city: string
  readonly countryCode: string
  readonly latitude?: number
  readonly longitude?: number
}

export interface ShippingProvider {
  readonly name: string
  calculate(country: string, subtotalAmount: number, weightGrams: number, currency: string): ShippingRate
  /** Optional capability: search nearby relay/pickup points for a postcode. */
  searchRelayPoints?(input: {
    countryCode: string
    postalCode: string
    count?: number
  }): Promise<RelayPoint[]>
}
