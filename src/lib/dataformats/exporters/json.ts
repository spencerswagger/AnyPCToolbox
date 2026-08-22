import { recordsToValue, type Records } from '../records'

export function recordsToJson(records: Records): string {
  return JSON.stringify(recordsToValue(records), null, 2)
}