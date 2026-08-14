/**
 * Minimal RFC4180 CSV parser: quoted fields (with "" escaping), commas and
 * newlines inside quotes, \r\n or \n line endings. No external dependency —
 * the export side already hand-rolls CSV, this is its inverse.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }

  // Last field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function toCsvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build an RFC4180 CSV string from records, in the given column order. */
export function recordsToCsv(records: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')]
  for (const rec of records) {
    lines.push(columns.map((col) => toCsvField(rec[col])).join(','))
  }
  return lines.join('\n')
}

/** Parse rows with a header into objects keyed by lowercased, trimmed header names. */
export function csvToRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  const header = rows[0]
  if (!header) return []
  const keys = header.map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const rec: Record<string, string> = {}
    keys.forEach((key, idx) => {
      rec[key] = row[idx] ?? ''
    })
    return rec
  })
}
