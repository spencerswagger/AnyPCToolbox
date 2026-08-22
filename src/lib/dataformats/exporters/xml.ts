import type { Records } from '../records.ts'

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function recordsToXml(records: Records): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<root>']
  for (const row of records.rows) {
    lines.push('  <item>')
    records.columns.forEach((c, i) => {
      const v = row[i]
      if (v === null || v === undefined) return
      const parts = c.split('.')
      let indent = 3
      for (let k = 0; k < parts.length - 1; k++) {
        lines.push(`${'  '.repeat(indent)}<${parts[k]}>`)
        indent++
      }
      lines.push(`${'  '.repeat(indent)}<${parts[parts.length - 1]}>${xmlEsc(String(v))}</${parts[parts.length - 1]}>`)
      for (let k = parts.length - 2; k >= 0; k--) {
        indent--
        lines.push(`${'  '.repeat(indent)}</${parts[k]}>`)
      }
    })
    lines.push('  </item>')
  }
  lines.push('</root>')
  return lines.join('\n')
}