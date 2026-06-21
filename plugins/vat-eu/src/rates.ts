export type VatRateEntry = {
  /** ISO 3166-1 alpha-2 */
  code: string
  standard: number
  reduced: number
  superReduced?: number | undefined
}

/** Official EU VAT rates (2024). Source: European Commission. */
export const EU_VAT_RATES: Record<string, VatRateEntry> = {
  AT: { code: 'AT', standard: 0.2, reduced: 0.1, superReduced: 0.1 },
  BE: { code: 'BE', standard: 0.21, reduced: 0.06 },
  BG: { code: 'BG', standard: 0.2, reduced: 0.09 },
  CY: { code: 'CY', standard: 0.19, reduced: 0.05 },
  CZ: { code: 'CZ', standard: 0.21, reduced: 0.12 },
  DE: { code: 'DE', standard: 0.19, reduced: 0.07 },
  DK: { code: 'DK', standard: 0.25, reduced: 0.25 },
  EE: { code: 'EE', standard: 0.22, reduced: 0.09 },
  ES: { code: 'ES', standard: 0.21, reduced: 0.1, superReduced: 0.04 },
  FI: { code: 'FI', standard: 0.255, reduced: 0.1 },
  FR: { code: 'FR', standard: 0.2, reduced: 0.1, superReduced: 0.055 },
  GR: { code: 'GR', standard: 0.24, reduced: 0.13, superReduced: 0.06 },
  HR: { code: 'HR', standard: 0.25, reduced: 0.13, superReduced: 0.05 },
  HU: { code: 'HU', standard: 0.27, reduced: 0.18, superReduced: 0.05 },
  IE: { code: 'IE', standard: 0.23, reduced: 0.135, superReduced: 0.09 },
  IT: { code: 'IT', standard: 0.22, reduced: 0.1, superReduced: 0.04 },
  LT: { code: 'LT', standard: 0.21, reduced: 0.09, superReduced: 0.05 },
  LU: { code: 'LU', standard: 0.17, reduced: 0.08, superReduced: 0.03 },
  LV: { code: 'LV', standard: 0.21, reduced: 0.12, superReduced: 0.05 },
  MT: { code: 'MT', standard: 0.18, reduced: 0.07, superReduced: 0.05 },
  NL: { code: 'NL', standard: 0.21, reduced: 0.09 },
  PL: { code: 'PL', standard: 0.23, reduced: 0.08, superReduced: 0.05 },
  PT: { code: 'PT', standard: 0.23, reduced: 0.13, superReduced: 0.06 },
  RO: { code: 'RO', standard: 0.19, reduced: 0.09, superReduced: 0.05 },
  SE: { code: 'SE', standard: 0.25, reduced: 0.12, superReduced: 0.06 },
  SI: { code: 'SI', standard: 0.22, reduced: 0.095, superReduced: 0.05 },
  SK: { code: 'SK', standard: 0.2, reduced: 0.1 },
}

export const EU_COUNTRY_CODES = new Set(Object.keys(EU_VAT_RATES))

export function isEuCountry(countryCode: string): boolean {
  return EU_COUNTRY_CODES.has(countryCode.toUpperCase())
}

export function getRates(countryCode: string): VatRateEntry | null {
  return EU_VAT_RATES[countryCode.toUpperCase()] ?? null
}
