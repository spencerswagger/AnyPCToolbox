import { recordsToValue, type Records } from '../records.ts'

export function recordsToJson(records: Records): string {
  return JSON.stringify(recordsToValue(records), null, 2)
}