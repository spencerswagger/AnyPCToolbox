import { stringify } from 'smol-toml'
import { recordsToValue, type Records } from '../records.ts'

export function recordsToToml(records: Records): string {
  return stringify({ records: recordsToValue(records) })
}