import { describe, expect, it } from 'vitest'
import { type FecEntry, generateFec } from './fec.js'

const entry: FecEntry = {
  ecritureDate: new Date(Date.UTC(2026, 5, 20)),
  pieceRef: '2026-000042',
  pieceDate: new Date(Date.UTC(2026, 5, 20)),
  label: 'Facture 2026-000042',
  auxNum: 'C0001',
  auxLib: 'Jean Dupont',
  netCents: 2000,
  vatCents: 400,
  totalCents: 2400,
}

function parse(fec: string) {
  const lines = fec.split('\r\n')
  return { header: lines[0]!.split('\t'), rows: lines.slice(1).map((l) => l.split('\t')) }
}

describe('generateFec', () => {
  it('emits the 18 mandatory FEC columns in order', () => {
    const { header } = parse(generateFec([entry]))
    expect(header).toHaveLength(18)
    expect(header.slice(0, 6)).toEqual([
      'JournalCode',
      'JournalLib',
      'EcritureNum',
      'EcritureDate',
      'CompteNum',
      'CompteLib',
    ])
    expect(header).toContain('Debit')
    expect(header).toContain('Credit')
    expect(header).toContain('ValidDate')
  })

  it('produces a balanced double entry (411 debit = 707 + 44571 credit)', () => {
    const { rows } = parse(generateFec([entry]))
    expect(rows).toHaveLength(3)
    const debitIdx = 11
    const creditIdx = 12
    const accountIdx = 4
    const totalDebit = rows.reduce((s, r) => s + Number(r[debitIdx]!.replace(',', '.')), 0)
    const totalCredit = rows.reduce((s, r) => s + Number(r[creditIdx]!.replace(',', '.')), 0)
    expect(totalDebit).toBeCloseTo(24)
    expect(totalCredit).toBeCloseTo(24)
    expect(rows[0]![accountIdx]).toBe('411000')
    expect(rows[0]![debitIdx]).toBe('24,00')
    expect(rows[1]![accountIdx]).toBe('707000')
    expect(rows[1]![creditIdx]).toBe('20,00')
    expect(rows[2]![accountIdx]).toBe('445710')
    expect(rows[2]![creditIdx]).toBe('4,00')
  })

  it('formats dates as YYYYMMDD and carries the customer aux account', () => {
    const { rows } = parse(generateFec([entry]))
    expect(rows[0]![3]).toBe('20260620') // EcritureDate
    expect(rows[0]![9]).toBe('20260620') // PieceDate
    expect(rows[0]![6]).toBe('C0001') // CompAuxNum
    expect(rows[0]![7]).toBe('Jean Dupont') // CompAuxLib
    expect(rows[0]![8]).toBe('2026-000042') // PieceRef
  })

  it('omits the VAT line for zero-rated invoices', () => {
    const { rows } = parse(
      generateFec([{ ...entry, vatCents: 0, netCents: 2400, totalCents: 2400 }]),
    )
    expect(rows).toHaveLength(2)
    expect(rows.some((r) => r[4] === '445710')).toBe(false)
  })

  it('increments EcritureNum per invoice and honours custom journal/accounts', () => {
    const fec = generateFec([entry, { ...entry, pieceRef: '2026-000043' }], {
      journalCode: 'VE',
      accounts: { sales: { num: '707100', lib: 'Prestations' } },
    })
    const { rows } = parse(fec)
    expect(rows[0]![0]).toBe('VE') // JournalCode
    expect(rows[0]![2]).toBe('1') // EcritureNum entry 1
    expect(rows[3]![2]).toBe('2') // EcritureNum entry 2
    expect(rows[1]![4]).toBe('707100') // custom sales account
  })
})
