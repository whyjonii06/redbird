export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amountMinor / 100)
}

export function formatPriceCompact(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100)
}
