// 运行：node scripts/verify-dataformats.ts
import { jsonToRecords } from '../src/lib/dataformats/importers/json.ts'
import { csvToRecords } from '../src/lib/dataformats/importers/csv.ts'
import { recordsToCsv } from '../src/lib/dataformats/exporters/csv.ts'
import { yamlToRecords } from '../src/lib/dataformats/importers/yaml.ts'
import { recordsToYaml } from '../src/lib/dataformats/exporters/yaml.ts'
import { tomlToRecords } from '../src/lib/dataformats/importers/toml.ts'
import { recordsToToml } from '../src/lib/dataformats/exporters/toml.ts'
import { xmlToRecords } from '../src/lib/dataformats/importers/xml.ts'
import { recordsToXml } from '../src/lib/dataformats/exporters/xml.ts'
import { getFormat } from '../src/lib/dataformats/registry.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('JSON round-trip')
{
  const rec = getFormat('json')!.importer('{"a":{"b":1},"c":[1,2]}')
  check('嵌套展开 a.b', rec.columns.includes('a.b') && rec.rows[0][rec.columns.indexOf('a.b')] === 1)
  const out = getFormat('json')!.exporter(rec)
  check('导出可再解析', JSON.parse(out)[0].a.b === 1)
}

console.log('CSV 转义')
{
  const csv = 'a,b,c\n"x,y","he said ""hi""","line1\nline2"'
  const rec = csvToRecords(csv)
  check('字段内逗号', rec.rows[0][0] === 'x,y')
  check('字段内引号', rec.rows[0][1] === 'he said "hi"')
  check('字段内换行', rec.rows[0][2] === 'line1\nline2')
  const back = recordsToCsv(rec)
  check('导出带 BOM 且可回读', back.charCodeAt(0) === 0xfeff && csvToRecords(back).rows[0][1] === 'he said "hi"')
}

console.log('CSV 脏行补齐')
{
  const rec = csvToRecords('h1,h2\n1\n2,3,4')
  check('列数=2', rec.columns.length === 2)
  check('脏行被截断', rec.rows[1][1] === '3')
}

console.log('YAML round-trip')
{
  const rec = yamlToRecords('name: 示例\nage: 18')
  check('列', rec.columns.includes('name') && rec.columns.includes('age'))
  check('导出可再解析', yamlToRecords(recordsToYaml(rec)).columns.length > 0)
}

console.log('TOML round-trip')
{
  const rec = tomlToRecords('name = "示例"\nage = 18')
  check('TOML 解析', rec.rows[0][rec.columns.indexOf('name')] === '示例')
  check('TOML 导出可解析', (() => { try { tomlToRecords(recordsToToml(rec)); return true } catch { return false } })())
}

console.log('表格头去重')
{
  const rec = csvToRecords('a,a,a\n1,2,3')
  check('去重后缀', rec.columns[0] === 'a' && rec.columns[1] === 'a_1' && rec.columns[2] === 'a_2')
}

console.log('空输入')
{
  check('空 JSON', getFormat('json')!.importer('').columns.length === 0)
  check('空 CSV', csvToRecords('').columns.length === 0)
}

console.log('深嵌套降级')
{
  const deep = JSON.stringify({ a: { b: { c: { d: { e: { f: 1 } } } } } })
  const rec = jsonToRecords(deep)
  check('深度超限转一列串', rec.columns.some((c) => c.startsWith('a.b.c.d.e')))
}

console.log('非法格式抛错')
{
  let threw = false
  try { jsonToRecords('{bad') } catch (e) { threw = e instanceof Error }
  check('JSON 非法抛错', threw)
}

console.log('XML（DOMParser 存在时）')
if (typeof DOMParser !== 'undefined') {
  const rec = xmlToRecords('<root><item><name>示例</name><age>18</age></item></root>')
  check('XML 解析', rec.columns.length > 0)
  const out = recordsToXml(rec)
  check('XML 导出', out.includes('<root>') && out.includes('<item>'))
} else {
  console.log('  - 跳过（Node 无 DOMParser）')
}

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)