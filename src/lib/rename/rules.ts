export type RuleType =
  | 'replace'
  | 'prefix'
  | 'suffix'
  | 'sequence'
  | 'timestamp'
  | 'case'
  | 'remove'
  | 'extension'

export interface ReplaceRule { type: 'replace'; find: string; with: string; onlyFirst: boolean; regex: boolean }
export interface AffixRule { type: 'prefix' | 'suffix'; text: string }
export interface SequenceRule { type: 'sequence'; start: number; step: number; width: number; position: 'front' | 'back'; sep: string }
export interface TimestampRule { type: 'timestamp'; format: string; source: 'now' | 'mtime'; position: 'front' | 'back'; sep: string }
export interface CaseRule { type: 'case'; mode: 'upper' | 'lower' | 'cap' }
export interface RemoveRule { type: 'remove'; start: number; count: number }
export interface ExtensionRule { type: 'extension'; mode: 'keep' | 'replace'; ext: string }

export type Rule =
  | ReplaceRule
  | AffixRule
  | SequenceRule
  | TimestampRule
  | CaseRule
  | RemoveRule
  | ExtensionRule

/** 规则类型下拉选项（顺序即展示顺序） */
export const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: 'replace', label: '查找-替换' },
  { value: 'prefix', label: '前缀' },
  { value: 'suffix', label: '后缀' },
  { value: 'sequence', label: '序号' },
  { value: 'timestamp', label: '时间戳' },
  { value: 'case', label: '大小写' },
  { value: 'remove', label: '删除字符' },
  { value: 'extension', label: '扩展名' },
]

export const RULE_LABEL: Record<RuleType, string> = Object.fromEntries(
  RULE_TYPES.map((r) => [r.value, r.label]),
) as Record<RuleType, string>

export const TIMESTAMP_FORMATS = ['YYYYMMDD', 'YYYY-MM-DD', 'YYYYMMDD_HHmmss', 'YYYY-MM-DD_HHmmss']

/** 时间戳格式(token) 最小实现：YYYY/YY/MM/DD/HH/mm/ss */
export function formatStamp(ms: number, format: string): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const map: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear()).slice(-2),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  }
  return format.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (t) => map[t] ?? t)
}

/** 创建某类型的默认规则实例 */
export function createRule(type: RuleType): Rule {
  switch (type) {
    case 'replace':
      return { type, find: '', with: '', onlyFirst: false, regex: false }
    case 'prefix':
      return { type, text: '' }
    case 'suffix':
      return { type, text: '' }
    case 'sequence':
      return { type, start: 1, step: 1, width: 2, position: 'front', sep: '_' }
    case 'timestamp':
      return { type, format: 'YYYYMMDD', source: 'mtime', position: 'front', sep: '_' }
    case 'case':
      return { type, mode: 'upper' }
    case 'remove':
      return { type, start: 1, count: 0 }
    case 'extension':
      return { type, mode: 'keep', ext: '' }
  }
}

/** 规则默认值是否「未配置」：用于校验哪些规则会被跳过 */
export function isRuleActive(r: Rule): boolean {
  switch (r.type) {
    case 'replace':
      return r.find.length > 0
    case 'prefix':
    case 'suffix':
      return r.text.length > 0
    case 'sequence':
    case 'timestamp':
    case 'case':
      return true
    case 'remove':
      return r.count > 0
    case 'extension':
      return r.mode === 'replace' ? r.ext.length > 0 : false
  }
}
