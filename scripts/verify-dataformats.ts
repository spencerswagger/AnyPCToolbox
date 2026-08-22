// 运行：node scripts/verify-dataformats.ts
import { jsonToNode } from '../src/lib/dataformats/importers/json.ts'
import { nodeToJson } from '../src/lib/dataformats/exporters/json.ts'
import { csvToNode } from '../src/lib/dataformats/importers/csv.ts'
import { nodeToCsv } from '../src/lib/dataformats/exporters/csv.ts'
import { yamlToNode } from '../src/lib/dataformats/importers/yaml.ts'
import { nodeToYaml } from '../src/lib/dataformats/exporters/yaml.ts'
import { tomlToNode } from '../src/lib/dataformats/importers/toml.ts'
import { nodeToToml } from '../src/lib/dataformats/exporters/toml.ts'
import { xmlToNode } from '../src/lib/dataformats/importers/xml.ts'
import { nodeToXml } from '../src/lib/dataformats/exporters/xml.ts'
import type { DataNode } from '../src/lib/dataformats/node.ts'
import { nodeToValue, flattenNode } from '../src/lib/dataformats/node.ts'
import { getFormat } from '../src/lib/dataformats/registry.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ak = Object.keys(a as Record<string, unknown>)
    const bk = Object.keys(b as Record<string, unknown>)
    return ak.length === bk.length && ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}
function nodeEq(a: DataNode, b: DataNode): boolean {
  return deepEqual(nodeToValue(a), nodeToValue(b))
}

console.log('JSON 无损往返（含数组/嵌套/深嵌套）')
{
  const src = '{"a":{"b":1},"c":[1,2],"items":[{"x":1},{"x":2}],"deep":{"l1":{"l2":{"l3":{"l4":5}}}}}'
  const n = jsonToNode(src)
  const out = nodeToJson(n)
  check('深嵌套不再被压平', out.includes('"l4"') && out.includes('"deep"'))
  check('数组元素保留', /"items": \[/.test(out))
  const n2 = jsonToNode(out)
  check('JSON→JSON 值完全一致', nodeEq(n, n2))
}

console.log('JSON → YAML → JSON 无损')
{
  const src = '[{"a":1,"arr":[1,2,3],"obj":{"x":{"y":1}},"flag":true,"nil":null}]'
  const n = jsonToNode(src)
  const yaml = nodeToYaml(n)
  const fromY = yamlToNode(yaml)
  check('YAML 还原值与源一致', nodeEq(n, fromY), JSON.stringify(yaml))
}

console.log('YAML 深层嵌套')
{
  const n = yamlToNode('a:\n  b:\n    c:\n      - 1\n      - 2\n')
  const back = yamlToNode(nodeToYaml(n))
  check('YAML 深度与数组往返一致', nodeEq(n, back))
}

console.log('TOML 嵌套表')
{
  const n = tomlToNode('[user]\nname = "示例"\n\n[user.profile]\ncity = "上海"')
  const back = tomlToNode(nodeToToml(n))
  check('TOML 嵌套恢复', (back.type === 'dict' || undefined) !== undefined)
  check('TOML 值保留', nodeEq(n, back))
}

console.log('CSV 转义')
{
  const csv = 'a,b,c\n"x,y","he said ""hi""","line1\nline2"'
  const rec = flattenNode(csvToNode(csv))
  check('字段内逗号', rec.rows[0][0] === 'x,y')
  check('字段内引号', rec.rows[0][1] === 'he said "hi"')
  check('字段内换行', rec.rows[0][2] === 'line1\nline2')
  const back = csvToNode(nodeToCsv(csvToNode(csv), rec))
  check('导出带 BOM 且可回读', nodeToCsv(csvToNode(csv), rec).charCodeAt(0) === 0xfeff)
  check('CSV→CSV 回读一致', nodeEq(csvToNode(csv), back))
}

console.log('复杂 → CSV（平坦端有损）')
{
  const n = jsonToNode('{"a":1,"obj":{"b":2},"arr":[1,2]}')
  const proj = flattenNode(n, 'flatten')
  check('flatten 展开为 obj.b 列', proj.columns.includes('obj.b'))
  check('数组压成单列串', JSON.stringify(proj.rows[0][proj.columns.indexOf('arr')]).includes('[1,2]'))
  const proj1 = flattenNode(n, 'firstLevel')
  check('firstLevel 不展开 obj', !proj1.columns.includes('obj.b'))
}

console.log('CSV 脏行补齐')
{
  const rec = flattenNode(csvToNode('h1,h2\n1\n2,3,4'))
  check('列数=2', rec.columns.length === 2)
  check('脏行被截断', rec.rows[1][1] === '3')
}

console.log('表格头去重')
{
  const rec = flattenNode(csvToNode('a,a,a\n1,2,3'))
  check('去重后缀', rec.columns[0] === 'a' && rec.columns[1] === 'a_1' && rec.columns[2] === 'a_2')
}

console.log('空输入')
{
  check('空 JSON → 空数组', jsonToNode('').type === 'array' && jsonToNode('').value.length === 0)
  check('空 CSV → 空数组', csvToNode('').value.length === 0)
}

console.log('解析失败抛 FormatError')
{
  let ok = false
  try { jsonToNode('{bad') } catch (e) { ok = e instanceof Error }
  check('JSON 非法抛错', ok)
}

console.log('XML（DOMParser 存在时）')
if (typeof DOMParser !== 'undefined') {
  const n = xmlToNode('<root><item><name>示例</name><age>18</age></item></root>')
  check('XML 解析出 dict', n.type === 'dict')
  const out = nodeToXml(n)
  check('XML 导出包含节点', out.includes('<item>') && out.includes('<name>'))
  check('XML 回读一致', nodeEq(n, xmlToNode(out)))
} else {
  console.log('  - 跳过（Node 无 DOMParser）')
}

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)