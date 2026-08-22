// 智能解码：启发式侦探（BFS 受限迭代）。结果仅供参考，不保证还原。
import { decodeBase64, decodeBase64Url, decodeUrl, decodeUnicode, decodeHex, decodeHtml, rot } from './encoders.ts'

export interface DecodeStep {
  algorithm: string
  output: string
  /** 0-100 可读性分数 */
  score: number
}

export interface DecodeChain {
  steps: DecodeStep[]
  final: string
  score: number
}

export interface SmartDecodeResult {
  chains: DecodeChain[]
  truncated: boolean
  note: string
}

/** 可打印字符比例（0-1） */
function printable(s: string): number {
  if (!s) return 0
  let p = 0
  for (const c of s) {
    const code = c.codePointAt(0)!
    if (code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0x7e) || code >= 0x80) p++
  }
  return p / Array.from(s).length
}

function looksJson(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (/^(?=[{\[])/.test(t)) {
    try {
      JSON.parse(t)
      return true
    } catch {
      return false
    }
  }
  return false
}

function scoreText(s: string): number {
  let sc = printable(s) * 100
  if (looksJson(s)) sc += 30
  if (/^[0-9a-zA-Z._\- ]+$/.test(s) && s.includes(' ')) sc += 10
  return Math.max(0, Math.round(sc))
}

type StepFn = (s: string) => { algo: string; out: string } | null

const STEPS: StepFn[] = [
  (s) => { const r = decodeBase64(s); return r.ok && r.value ? { algo: 'Base64', out: r.value } : null },
  (s) => { const r = decodeBase64Url(s); return r.ok && r.value ? { algo: 'Base64URL', out: r.value } : null },
  (s) => { const r = decodeUrl(s); return r.ok && r.value !== s ? { algo: 'URL', out: r.value } : null },
  (s) => { const r = decodeUnicode(s); return r.ok && r.value ? { algo: 'Unicode 转义', out: r.value } : null },
  (s) => { const r = decodeHtml(s); return r.ok && r.value !== s ? { algo: 'HTML 实体', out: r.value } : null },
  (s) => { const r = decodeHex(s); return r.ok && r.value ? { algo: 'Hex', out: r.value } : null },
  (s) => { const r = rot(s, 13); return r.ok && r.value !== s ? { algo: 'ROT13', out: r.value } : null },
]

/**
 * 智能解码：从 input 反复尝试常见算法，累积换取可读性不降级的链。
 * maxRounds 限制迭代轮次，limit 限制返回链上限，避免指数爆炸。
 * 用 seen 集合防环（避免 A→B→A），用「可读性不降级」作为推进门槛，
 * 允许分数相等但确实成功的解码（如 Base64 aGk=→hi）。
 */
export function smartDecode(input: string, maxRounds = 8, limit = 12): SmartDecodeResult {
  const note = '智能解码为启发式结果，结果仅供参考'
  const chains: DecodeChain[] = []
  let truncated = false

  const initialScore = scoreText(input)
  const seen = new Set<string>([input])
  // BFS：队列元素为 { s, steps }
  let frontier: { s: string; steps: DecodeStep[] }[] = [{ s: input, steps: [] }]

  for (let round = 0; round < maxRounds; round++) {
    const next: { s: string; steps: DecodeStep[] }[] = []
    for (const node of frontier) {
      if (node.steps.length > 0) chains.push({ steps: node.steps, final: node.s, score: node.steps[node.steps.length - 1].score })
      if (chains.length >= limit) { truncated = true; break }
      const nodeScore = scoreText(node.s)
      for (const step of STEPS) {
        const r = step(node.s)
        if (!r) continue
        if (seen.has(r.out)) continue
        const sc = scoreText(r.out)
        // 可读性不降级才继续，且防环；允许相等分数（成功的解码也推进）
        if (sc >= nodeScore) {
          seen.add(r.out)
          next.push({ s: r.out, steps: [...node.steps, { algorithm: r.algo, output: r.out, score: sc }] })
        }
      }
      if (chains.length >= limit) { truncated = true; break }
    }
    if (truncated || next.length === 0) break
    frontier = next.slice(0, limit)
  }

  // 无任何进步时，至少给一条候选提示保持空态友好
  if (chains.length === 0) {
    chains.push({ steps: [], final: input, score: initialScore })
  }
  // 按分数倒序，去重 final
  const finalSeen = new Set<string>()
  const out = chains
    .slice()
    .sort((a, b) => b.score - a.score)
    .filter((c) => { if (finalSeen.has(c.final)) return false; finalSeen.add(c.final); return true })
    .slice(0, limit)
  return { chains: out, truncated, note }
}