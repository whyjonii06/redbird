/**
 * FEC — Fichier des Écritures Comptables (French mandatory accounting export,
 * art. A47 A-1 LPF). A tab-delimited file with 18 mandatory columns, one row
 * per accounting entry line. Each sales invoice becomes a balanced double entry:
 *   411 Clients         (debit  = total incl. VAT)
 *   707 Ventes          (credit = net excl. VAT)
 *   44571 TVA collectée (credit = VAT)
 *
 * Dependency-free, pure, fully testable.
 */

export type FecAccount = { num: string; lib: string }
export type FecAccounts = { customer: FecAccount; sales: FecAccount; vat: FecAccount }

export const DEFAULT_FEC_ACCOUNTS: FecAccounts = {
  customer: { num: '411000', lib: 'Clients' },
  sales: { num: '707000', lib: 'Ventes de marchandises' },
  vat: { num: '445710', lib: 'TVA collectée' },
}

export type FecEntry = {
  /** Accounting entry date (usually the invoice date). */
  ecritureDate: Date
  /** Invoice number (PieceRef). */
  pieceRef: string
  pieceDate: Date
  /** Free-text label for the entry. */
  label: string
  /** Customer auxiliary account number + label (sub-ledger of 411). */
  auxNum?: string
  auxLib?: string
  /** Net amount excl. VAT, in cents. */
  netCents: number
  /** VAT amount, in cents. */
  vatCents: number
  /** Total incl. VAT, in cents. */
  totalCents: number
}

export type FecOptions = {
  journalCode?: string
  journalLib?: string
  accounts?: Partial<FecAccounts>
}

const COLUMNS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
]

function ymd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Cents → FEC decimal (2 dp, comma separator). */
function amt(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Strip tabs/newlines from free-text fields so columns stay aligned. */
function clean(v: string): string {
  return v.replace(/[\t\r\n]+/g, ' ').trim()
}

/** Generate a FEC file (tab-delimited) from a list of invoice entries. */
export function generateFec(entries: FecEntry[], options: FecOptions = {}): string {
  const journalCode = options.journalCode ?? 'VT'
  const journalLib = options.journalLib ?? 'Ventes'
  const accounts: FecAccounts = {
    customer: options.accounts?.customer ?? DEFAULT_FEC_ACCOUNTS.customer,
    sales: options.accounts?.sales ?? DEFAULT_FEC_ACCOUNTS.sales,
    vat: options.accounts?.vat ?? DEFAULT_FEC_ACCOUNTS.vat,
  }

  const rows: string[] = [COLUMNS.join('\t')]

  entries.forEach((entry, i) => {
    const num = String(i + 1)
    const ecritureDate = ymd(entry.ecritureDate)
    const pieceDate = ymd(entry.pieceDate)
    const lib = clean(entry.label)

    const line = (
      compteNum: string,
      compteLib: string,
      debit: number,
      credit: number,
      auxNum = '',
      auxLib = '',
    ): string =>
      [
        journalCode,
        journalLib,
        num,
        ecritureDate,
        compteNum,
        compteLib,
        auxNum,
        auxLib,
        clean(entry.pieceRef),
        pieceDate,
        lib,
        amt(debit),
        amt(credit),
        '', // EcritureLet
        '', // DateLet
        ecritureDate, // ValidDate
        '', // Montantdevise
        '', // Idevise
      ].join('\t')

    // 411 Clients — debit total incl. VAT
    rows.push(
      line(
        accounts.customer.num,
        accounts.customer.lib,
        entry.totalCents,
        0,
        entry.auxNum ? clean(entry.auxNum) : '',
        entry.auxLib ? clean(entry.auxLib) : '',
      ),
    )
    // 707 Ventes — credit net excl. VAT
    rows.push(line(accounts.sales.num, accounts.sales.lib, 0, entry.netCents))
    // 44571 TVA collectée — credit VAT (only if any)
    if (entry.vatCents > 0) {
      rows.push(line(accounts.vat.num, accounts.vat.lib, 0, entry.vatCents))
    }
  })

  return rows.join('\r\n')
}
