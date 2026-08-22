// 时间戳与日期串双向识别（纯函数）

export interface TimestampHit {
  raw: string
  kind: 'unixSec' | 'unixMs' | 'date'
  local: string
  iso: string
  unixSec: number
  unixMs: number
}

const pad = (n: number): string => String(n).padStart(2, '0')

function fmtLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** 由 Date 构建命中 */
function fromDate(d: Date, raw: string, kind: TimestampHit['kind']): TimestampHit {
  return { raw, kind, local: fmtLocal(d), iso: d.toISOString(), unixSec: Math.floor(d.getTime() / 1000), unixMs: d.getTime() }
}

const RE_DATE =
  /(?<y>\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?|((?:0?\d|1[0-2]):[0-5]\d\s?[AaPp][Mm])/g

/** 扫描文本，返回所有时间戳命中（Unix 秒/毫秒 + 日期串） */
export function extractTimestamps(input: string): TimestampHit[] {
  const hits: TimestampHit[] = []
  // 1) 独立的 10/13 位数字（Unix 秒/毫秒）
  for (const m of input.matchAll(/(^|[^0-9])(\d{10}|\d{13})(?![0-9])/g)) {
    const raw = m[2]
    const num = Number(raw)
    const isMs = raw.length === 13
    const ms = isMs ? num : num * 1000
    const d = new Date(ms)
    if (!isNaN(d.getTime())) hits.push(fromDate(d, raw, isMs ? 'unixMs' : 'unixSec'))
  }
  // 2) 日期串
  for (const m of input.matchAll(RE_DATE)) {
    const g = m.groups ?? {}
    if (g['y']) {
      const y = Number(g['y'])
      const mo = Number(m[2])
      const d = Number(m[3])
      const hh = g['4'] ? Number(g['4']) : 0
      const mm = g['5'] ? Number(g['5']) : 0
      const ss = g['6'] ? Number(g['6']) : 0
      const dt = new Date(y, mo - 1, d, hh, mm, ss)
      if (!isNaN(dt.getTime()) && dt.getMonth() === mo - 1 && dt.getDate() === d) {
        hits.push(fromDate(dt, m[0], 'date'))
      }
    } else if (g['7']) {
      const ampm = /[Aa]/.test(g['7']) ? 0 : 12
      const parts = m[0].match(/(\d{1,2}):(\d{2})/)
      if (parts) {
        let hh = Number(parts[1]) % 12
        hh += ampm
        const dt = new Date()
        dt.setHours(hh, Number(parts[2]), 0, 0)
        hits.push(fromDate(dt, m[0], 'date'))
      }
    }
  }
  return hits
}