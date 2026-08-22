import { parse } from 'yaml'
import { FormatError, valueToRecords, type FlattenStrategy } from '../records'

export function yamlToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  let value: unknown
  try {
    value = parse(text)
  } catch (e) {
    throw new FormatError(`YAML 解析失败：${(e as Error).message}`)
  }
  if (value === null || value === undefined) return { columns: [], rows: [] }
  return valueToRecords(value, strategy)
}