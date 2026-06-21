export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amountMinor / 100)
}

export function pageNumber(n: number): string {
  return String(n).padStart(3, '0')
}
