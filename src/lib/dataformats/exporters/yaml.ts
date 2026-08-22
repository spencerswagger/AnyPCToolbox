import { stringify } from 'yaml'
import { recordsToValue, type Records } from '../records.ts'

export function recordsToYaml(records: Records): string {
  return stringify(recordsToValue(records))
}