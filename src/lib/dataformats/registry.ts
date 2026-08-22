import type { FlattenStrategy, Records } from './records.ts'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml'
import { FormatError } from './records.ts'
import { jsonToRecords } from './importers/json.ts'
import { recordsToJson } from './exporters/json.ts'
import { csvToRecords } from './importers/csv.ts'
import { recordsToCsv } from './exporters/csv.ts'
import { yamlToRecords } from './importers/yaml.ts'
import { recordsToYaml } from './exporters/yaml.ts'
import { tomlToRecords } from './importers/toml.ts'
import { recordsToToml } from './exporters/toml.ts'
import { xmlToRecords } from './importers/xml.ts'
import { recordsToXml } from './exporters/xml.ts'

export type Importer = (text: string, strategy?: FlattenStrategy) => Records
export type Exporter = (records: Records) => string
// 格式化当前源文本（美化重排），不改变数据结构；返回 null 表示此格式无需格式化
export type Formatter = (text: string) => string

export interface FormatDescriptor {
  id: string
  label: string
  importer: Importer
  exporter: Exporter
  format: Formatter | null
  ext: string
  // 每种策略各一份示例，突出该策略的展开效果
  samples: Record<FlattenStrategy, string>
}

const JSON_SAMPLE_DEEP =
  '[{"order":1,"user":{"name":"小明","profile":{"city":"上海","hobbies":["篮球","摄影"]}},"active":true}]'
const JSON_SAMPLE_SHALLOW =
  '{"name":"小明","address":{"city":"上海","zip":200000},"tags":["a","b","c"]}'

export const FORMATS: FormatDescriptor[] = [
  {
    id: 'json', label: 'JSON',
    importer: jsonToRecords, exporter: recordsToJson,
    format: (t) => { try { return JSON.stringify(JSON.parse(t), null, 2) } catch (e) { throw new FormatError(`JSON 格式化失败：${(e as Error).message}`) } },
    ext: 'json',
    samples: { flatten: JSON_SAMPLE_DEEP, firstLevel: JSON_SAMPLE_SHALLOW },
  },
  {
    id: 'yaml', label: 'YAML',
    importer: yamlToRecords, exporter: recordsToYaml,
    format: (t) => { try { return yamlStringify(yamlParse(t)) } catch (e) { throw new FormatError(`YAML 格式化失败：${(e as Error).message}`) } },
    ext: 'yaml',
    samples: {
      flatten: '- order: 1\n  user:\n    name: 小明\n    profile:\n      city: 上海\n      hobbies:\n        - 篮球\n        - 摄影\n  active: true',
      firstLevel: 'name: 小明\naddress:\n  city: 上海\n  zip: 200000\ntags:\n  - a\n  - b\n  - c',
    },
  },
  {
    id: 'csv', label: 'CSV',
    importer: csvToRecords, exporter: recordsToCsv,
    // CSV 无缩进结构，仅去首尾空白/空行
    format: (t) => t.replace(/^\s+|\s+$/g, '').replace(/^\r?\n/, '').replace(/\r?\n$/m, ''),
    ext: 'csv',
    samples: {
      flatten: 'cs_id,name,email,salary\n1,"张三,丰",zs@example.com,"5,000"\n2,李四,ls@example.com,8000\n3,王五,ww@example.com,"12,500"',
      firstLevel: 'cs_id,name,email,salary\n1,"张三,丰",zs@example.com,"5,000"\n2,李四,ls@example.com,8000',
    },
  },
  {
    id: 'toml', label: 'TOML',
    importer: tomlToRecords, exporter: recordsToToml,
    format: (t) => { try { return tomlStringify(tomlParse(t)) } catch (e) { throw new FormatError(`TOML 格式化失败：${(e as Error).message}`) } },
    ext: 'toml',
    samples: {
      flatten: 'order = 1\nactive = true\n\n[user]\nname = "小明"\n\n[user.profile]\ncity = "上海"\nhobbies = ["篮球", "摄影"]',
      firstLevel: 'name = "小明"\n\n[address]\ncity = "上海"\nzip = 200000',
    },
  },
  {
    id: 'xml', label: 'XML',
    importer: xmlToRecords, exporter: recordsToXml,
    format: formatXml,
    ext: 'xml',
    samples: {
      flatten: '<users><user><order>1</order><name>小明</name><profile><city>上海</city><hobbies>篮球</hobbies><hobbies>摄影</hobbies></profile><active>true</active></user></users>',
      firstLevel: '<root><name>小明</name><address><city>上海</city><zip>200000</zip></address></root>',
    },
  },
]

// 轻量 XML 美化：解析 → 缩进重排，保留属性；解析失败抛 FormatError
function formatXml(text: string): string {
  const isXmlDeclaration = /^\s*<\?xml/.test(text)
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    if (doc.querySelector('parsererror')) throw new Error('XML 解析失败')
    const root = doc.documentElement
    if (!root) return text
    const lines: string[] = []
    if (isXmlDeclaration) lines.push('<?xml version="1.0" encoding="UTF-8"?>')
    walkXml(root, 0, lines)
    return lines.join('\n')
  } catch (e) {
    throw new FormatError(`XML 格式化失败：${(e as Error).message}`)
  }
}
function walkXml(el: Element, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth)
  const attrs = Array.from(el.attributes).map((a) => ` ${a.name}="${a.value}"`).join('')
  const children = Array.from(el.children)
  if (children.length === 0) {
    const inner = (el.textContent ?? '').trim()
    lines.push(`${pad}<${el.nodeName}${attrs}${inner ? `>${inner}</${el.nodeName}>` : ' />'}`)
  } else {
    lines.push(`${pad}<${el.nodeName}${attrs}>`)
    for (const c of children) walkXml(c, depth + 1, lines)
    lines.push(`${pad}</${el.nodeName}>`)
  }
}

export function getFormat(id: string): FormatDescriptor | undefined {
  return FORMATS.find((f) => f.id === id)
}