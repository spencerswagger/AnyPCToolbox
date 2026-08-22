// build.ts：单个文件"根名" -> 新"根名"的纯函数（不含扩展名规则）
// 规则按数组顺序依次作用。扩展名在 preview.ts 层处理，不进入本函数。
import { formatStamp, type Rule, type ReplaceRule } from './rules.ts'

export interface BuildContext {
  /** 该文件在其预览队列中的序号（0 起） */
  index: number
  /** 文件修改时间(ms)；无则 undefined（时间戳 source='mtime' 时回退当前时间） */
  mtime?: number
}

export function buildName(stem: string, rules: Rule[], ctx: BuildContext): string {
  let name = stem
  for (const rule of rules) {
    if (rule.type === 'extension') continue // 扩展名在 preview 层处理
    name = applyRule(name, rule, ctx)
  }
  return name
}

function applyRule(name: string, rule: Rule, ctx: BuildContext): string {
  switch (rule.type) {
    case 'replace':
      return applyReplace(name, rule)
    case 'prefix':
      return rule.text + name
    case 'suffix':
      return name + rule.text
    case 'sequence': {
      const seq = String(rule.start + ctx.index * rule.step).padStart(rule.width, '0')
      return rule.position === 'front' ? seq + rule.sep + name : name + rule.sep + seq
    }
    case 'timestamp': {
      const t = rule.source === 'mtime' && ctx.mtime != null ? ctx.mtime : Date.now()
      return rule.position === 'front'
        ? formatStamp(t, rule.format) + rule.sep + name
        : name + rule.sep + formatStamp(t, rule.format)
    }
    case 'case':
      if (rule.mode === 'upper') return name.toUpperCase()
      if (rule.mode === 'lower') return name.toLowerCase()
      return name.charAt(0).toUpperCase() + name.slice(1)
    case 'remove': {
      // 按 Unicode 字符计数，从 start(1 起) 删 count 个
      const chars = [...name]
      const startIdx = rule.start - 1
      if (startIdx < 0 || startIdx >= chars.length) return name
      return chars.slice(0, startIdx).concat(chars.slice(startIdx + rule.count)).join('')
    }
    default:
      return name
  }
}

function applyReplace(name: string, rule: ReplaceRule): string {
  if (!rule.find) return name
  if (rule.regex) {
    try {
      const flags = rule.onlyFirst ? 'u' : 'gu'
      return name.replace(new RegExp(rule.find, flags), rule.with)
    } catch {
      return name
    }
  }
  if (rule.onlyFirst) return name.replace(rule.find, rule.with)
  return name.split(rule.find).join(rule.with)
}
