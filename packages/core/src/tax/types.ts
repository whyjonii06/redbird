export type TaxCalculation = {
  countryCode: string
  rate: number
  rateType: string
  taxAmount: number
  reverseCharge: boolean
}

export interface TaxProvider {
  readonly name: string
  calculate(
    subtotalCents: number,
    countryCode: string,
    opts?: { rateType?: string; vatNumber?: string },
  ): TaxCalculation
}
