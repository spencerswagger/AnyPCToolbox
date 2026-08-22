// 开发期重抓汇率快照覆盖 src/data/rates.json（在线源 open.er-api.com，免 key、CORS 开放）
// 运行：node scripts/update-rates.ts
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'https://open.er-api.com/v6/latest/USD'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../src/data/rates.json')

async function main(): Promise<void> {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as {
    result?: string
    time_last_update_utc?: string
    base_code?: string
    rates?: Record<string, number>
  }
  if (data.result !== 'success' || !data.rates || !data.base_code) throw new Error('响应格式异常')
  const snapshot = {
    _source: URL,
    _updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
    base: data.base_code,
    rates: data.rates,
  }
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`已写入 ${OUT}：${data.base_code} 基准，${Object.keys(data.rates).length} 种币种`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
