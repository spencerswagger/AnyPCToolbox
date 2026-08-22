import { FormatError, valueToRecords, type FlattenStrategy } from '../records'

export function jsonToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    throw new FormatError(`JSON 解析失败：${(e as Error).message}`)
  }
  return valueToRecords(value, strategy)
}