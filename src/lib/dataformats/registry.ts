import type { FlattenStrategy, Records } from './records.ts'
import { jsonToRecords } from './importers/json.ts'
import { recordsToJson } from './exporters/json.ts'
import { csvToRecords } from './importers/csv.ts'
import { recordsToCsv } from './exporters/csv.ts'
import { yamlToRecords } from './importers/yaml.ts'
import { recordsToYaml } from './exporters/yaml.ts'
import { tomlToRecords } from './importers/toml.ts'
import { recordsToToml } from './exporters/toml.ts'
import { xmlToRecords } from './importers/xml.ts'
import { recordsToXml } from './exporters/xml.ts'

export type Importer = (text: string, strategy?: FlattenStrategy) => Records
export type Exporter = (records: Records) => string

export interface FormatDescriptor {
  id: string
  label: string
  importer: Importer
  exporter: Exporter
  ext: string
  sample: string
}

export const FORMATS: FormatDescriptor[] = [
  {
    id: 'json', label: 'JSON',
    importer: jsonToRecords, exporter: recordsToJson, ext: 'json',
    sample: '{ "name": "示例", "age": 18 }',
  },
  {
    id: 'yaml', label: 'YAML',
    importer: yamlToRecords, exporter: recordsToYaml, ext: 'yaml',
    sample: 'name: 示例\nage: 18',
  },
  {
    id: 'csv', label: 'CSV',
    importer: csvToRecords, exporter: recordsToCsv, ext: 'csv',
    sample: 'name,age\n示例,18',
  },
  {
    id: 'toml', label: 'TOML',
    importer: tomlToRecords, exporter: recordsToToml, ext: 'toml',
    sample: 'name = "示例"\nage = 18',
  },
  {
    id: 'xml', label: 'XML',
    importer: xmlToRecords, exporter: recordsToXml, ext: 'xml',
    sample: '<root><item><name>示例</name><age>18</age></item></root>',
  },
]

export function getFormat(id: string): FormatDescriptor | undefined {
  return FORMATS.find((f) => f.id === id)
}