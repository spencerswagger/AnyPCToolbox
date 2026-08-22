import { stringify } from 'smol-toml'
import { recordsToValue, type Records } from '../records'

export function recordsToToml(records: Records): string {
  return stringify(recordsToValue(records) as never)
}