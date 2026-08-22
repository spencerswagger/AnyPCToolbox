import { FormatError, valueToRecords, type FlattenStrategy } from '../records.ts'

export function jsonToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  let value: unknown
  if (!text.trim()) return { columns: [], rows: [] }
  try {
    value = JSON.parse(text)
  } catch (e) {
    throw new FormatError(`JSON 解析失败：${(e as Error).message}`)
  }
  return valueToRecords(value, strategy)
}