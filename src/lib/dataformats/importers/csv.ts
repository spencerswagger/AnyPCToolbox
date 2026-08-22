import { buildRecords, type Cell } from '../records'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push(row); row = [] }
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { pushField(); i++; continue }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; pushRow(); i++; continue }
    if (ch === '\n') { pushRow(); i++; continue }
    field += ch; i++
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

export function csvToRecords(text: string) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { columns: [], rows: [] }
  const body = rows.slice(1).map((r) => r as Cell[])
  return buildRecords(rows[0], body)
}