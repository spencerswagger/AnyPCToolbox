// 区划数据访问层：内置 china.json 快照，提供查询、级联下拉选项
import chinaJson from '@/data/china.json'
import { PLACEHOLDER_NAMES, type AreaMap } from '@/lib/idcard'

export interface ChinaData {
  _source: string
  _license: string
  _updatedAt: string
  areas: AreaMap
}

const chinaData = chinaJson as unknown as ChinaData

export const areaSource: string = chinaData._source
export const areaUpdatedAt: string = chinaData._updatedAt
export const areas: AreaMap = chinaData.areas

export interface AreaOption {
  code: string
  name: string
}

/** 省级选项（含港澳台）。数据源中 710000 与 830000 均为"台湾省"，按名称去重只保留行政区划标准编码(710000) */
export const provinceOptions: AreaOption[] = Object.entries(areas)
  .filter(([code, name]) => /^\d{2}0000$/.test(code) && !PLACEHOLDER_NAMES.has(name))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code))
  .filter((opt, i, arr) => arr.findIndex((o) => o.name === opt.name) === i)

/** 市级选项；直辖市/省直辖县返回空数组（区县直接挂在省下） */
export function cityOptions(provinceCode: string): AreaOption[] {
  if (!provinceCode) return []
  const prefix = provinceCode.slice(0, 2)
  return Object.entries(areas)
    .filter(
      ([code, name]) =>
        /^\d{4}00$/.test(code) && code.startsWith(prefix) && code !== provinceCode && !PLACEHOLDER_NAMES.has(name),
    )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

/** 区县选项；传市码取该市下区县，不传市码取全省区县（用于直辖市） */
export function districtOptions(provinceCode: string, cityCode?: string): AreaOption[] {
  if (!provinceCode) return []
  const prefix = cityCode ? cityCode.slice(0, 4) : provinceCode.slice(0, 2)
  return Object.entries(areas)
    .filter(
      ([code, name]) =>
        /^\d{6}$/.test(code) && !code.endsWith('00') && code.startsWith(prefix) && !PLACEHOLDER_NAMES.has(name),
    )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
