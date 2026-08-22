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

/**
 * 有意义的自然文本程度（0-100，兼作置信度）：
 * 越像正常可读文本（大量单词 + 元音 + 空格）得分越高，避免「纯可打印字符」导致置信度恒为 100。
 */
function meaningScore(s: string): number {
  const t = s.trim()
  if (!t) return 0
  if (looksJson(t)) return 100
  const chars = Array.from(t)
  const letters = t.replace(/[^a-zA-Z]/g, '').length
  const alphaFraction = letters / chars.length
  const lower = t.toLowerCase()
  const tokens = lower.split(/[^a-z0-9']+/).filter(Boolean)
  if (!tokens.length) return Math.round(alphaFraction * 50)
  const wordy = tokens.filter((w) => /^[a-z']+$/.test(w)).length / tokens.length
  const avgLen = tokens.reduce((a, w) => a + w.length, 0) / tokens.length
  const hasVowel = tokens.some((w) => w.length >= 2 && /[aeiouy]/.test(w))
  let sc = alphaFraction * 50
  if (wordy >= 0.6) sc += 30
  if (hasVowel) sc += 15
  if (t.includes(' ')) sc += 5
  if (avgLen < 2) sc -= 20
  return Math.max(0, Math.min(100, Math.round(sc)))
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
 * 智能解码：从 input 反复尝试常见算法，累积换取「可读性严格提升」的链。
 * - maxRounds 含整轮（`<=`），填 1 也能产出首层候选。
 * - 用 meaningScore 作门槛，只有解码后比当前明显更「像人话」才收录，
 *   避免 ROT13 等恒变换产生噪音候选，也让置信度随可读性变化而非恒 100。
 * - 无候选时不造假候选，由面板展示空态。
 */
export function smartDecode(input: string, maxRounds = 8, limit = 12): SmartDecodeResult {
  const note = '智能解码为启发式结果，结果仅供参考'
  const chains: DecodeChain[] = []
  let truncated = false

  const seen = new Set<string>([input])
  // BFS：队列元素为 { s, steps }
  let frontier: { s: string; steps: DecodeStep[] }[] = [{ s: input, steps: [] }]

  for (let round = 1; round <= maxRounds; round++) {
    const next: { s: string; steps: DecodeStep[] }[] = []
    for (const node of frontier) {
      const nodeScore = meaningScore(node.s)
      for (const step of STEPS) {
        const r = step(node.s)
        if (!r) continue
        if (seen.has(r.out)) continue
        const sc = meaningScore(r.out)
        // 意义不降级才继续，且防环；相等分数不推进（抵消 ROT 这类恒成立的噪音）
        if (sc > nodeScore) {
          seen.add(r.out)
          const steps = [...node.steps, { algorithm: r.algo, output: r.out, score: sc }]
          chains.push({ steps, final: r.out, score: sc })
          next.push({ s: r.out, steps })
        }
      }
      if (chains.length >= limit) { truncated = true; break }
    }
    if (truncated) break
    if (next.length === 0) break
    frontier = next.slice(0, limit)
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