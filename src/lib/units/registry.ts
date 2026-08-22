// 单位注册表：8 种量纲、别名 → 规范单位、线性/非线性换算因子
// 换算基准：长度 m / 重量 kg / 数据量 B(1000 进制) / 温度 ℃ / 面积 ㎡ / 体积 L / 时间 s / 货币 USD
// 货币汇率是运行时数据（见 money.ts），此处仅登记币种别名供词法识别。

export type Dim = 'length' | 'weight' | 'data' | 'temperature' | 'area' | 'volume' | 'time' | 'currency'

export interface UnitDef {
  /** 规范名（如 km、斤、℉） */
  canonical: string
  /** 展示名 */
  name: string
  dim: Dim
  /** 线性换算：valueInBase = value * factor（相对该量纲基准） */
  factor?: number
  /** 非线性换算（温度）：该单位 → 基准 ℃ */
  toBase?: (v: number) => number
  /** 非线性换算（温度）：基准 ℃ → 该单位 */
  fromBase?: (v: number) => number
  /** 结果为近似值（month/year） */
  approx?: boolean
}

export interface DimDef {
  id: Dim
  label: string
  base: string
}

export const DIMS: DimDef[] = [
  { id: 'length', label: '长度', base: 'm' },
  { id: 'weight', label: '重量', base: 'kg' },
  { id: 'data', label: '数据量', base: 'B' },
  { id: 'temperature', label: '温度', base: '℃' },
  { id: 'area', label: '面积', base: '㎡' },
  { id: 'volume', label: '体积', base: 'L' },
  { id: 'time', label: '时间', base: 's' },
  { id: 'currency', label: '货币', base: 'USD' },
]

export const DIM_LABEL: Record<Dim, string> = DIMS.reduce(
  (acc, d) => {
    acc[d.id] = d.label
    return acc
  },
  {} as Record<Dim, string>,
)

export const UNITS: Record<Dim, UnitDef[]> = {
  length: [
    { canonical: 'km', name: '千米', dim: 'length', factor: 1e3 },
    { canonical: 'm', name: '米', dim: 'length', factor: 1 },
    { canonical: 'cm', name: '厘米', dim: 'length', factor: 1e-2 },
    { canonical: 'mm', name: '毫米', dim: 'length', factor: 1e-3 },
    { canonical: 'in', name: '英寸', dim: 'length', factor: 0.0254 },
    { canonical: 'ft', name: '英尺', dim: 'length', factor: 0.3048 },
    { canonical: 'yd', name: '码', dim: 'length', factor: 0.9144 },
    { canonical: 'mi', name: '英里', dim: 'length', factor: 1609.344 },
    { canonical: '里', name: '里', dim: 'length', factor: 500 },
    { canonical: '尺', name: '尺', dim: 'length', factor: 1 / 3 },
    { canonical: '寸', name: '寸', dim: 'length', factor: 1 / 30 },
  ],
  weight: [
    { canonical: 't', name: '吨', dim: 'weight', factor: 1e3 },
    { canonical: 'kg', name: '千克', dim: 'weight', factor: 1 },
    { canonical: 'g', name: '克', dim: 'weight', factor: 1e-3 },
    { canonical: 'mg', name: '毫克', dim: 'weight', factor: 1e-6 },
    { canonical: 'μg', name: '微克', dim: 'weight', factor: 1e-9 },
    { canonical: 'lb', name: '磅', dim: 'weight', factor: 0.45359237 },
    { canonical: 'oz', name: '盎司', dim: 'weight', factor: 0.028349523125 },
    { canonical: '斤', name: '斤', dim: 'weight', factor: 0.5 },
    { canonical: '两', name: '两', dim: 'weight', factor: 0.05 },
  ],
  data: [
    { canonical: 'TB', name: '太字节', dim: 'data', factor: 1e12 },
    { canonical: 'GB', name: '吉字节', dim: 'data', factor: 1e9 },
    { canonical: 'MB', name: '兆字节', dim: 'data', factor: 1e6 },
    { canonical: 'KB', name: '千字节', dim: 'data', factor: 1e3 },
    { canonical: 'B', name: '字节', dim: 'data', factor: 1 },
  ],
  temperature: [
    { canonical: '℃', name: '摄氏度', dim: 'temperature', toBase: (v) => v, fromBase: (v) => v },
    {
      canonical: '℉',
      name: '华氏度',
      dim: 'temperature',
      toBase: (v) => ((v - 32) * 5) / 9,
      fromBase: (v) => (v * 9) / 5 + 32,
    },
    { canonical: 'K', name: '开尔文', dim: 'temperature', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
  area: [
    { canonical: 'km²', name: '平方公里', dim: 'area', factor: 1e6 },
    { canonical: 'ha', name: '公顷', dim: 'area', factor: 1e4 },
    { canonical: '英亩', name: '英亩', dim: 'area', factor: 4046.8564224 },
    { canonical: '亩', name: '亩', dim: 'area', factor: 2000 / 3 },
    { canonical: 'ft²', name: '平方英尺', dim: 'area', factor: 0.09290304 },
    { canonical: '平方尺', name: '平方尺', dim: 'area', factor: 1 / 9 },
    { canonical: '㎡', name: '平方米', dim: 'area', factor: 1 },
  ],
  volume: [
    { canonical: 'm³', name: '立方米', dim: 'volume', factor: 1e3 },
    { canonical: 'L', name: '升', dim: 'volume', factor: 1 },
    { canonical: 'mL', name: '毫升', dim: 'volume', factor: 1e-3 },
    { canonical: 'cm³', name: '立方厘米', dim: 'volume', factor: 1e-3 },
    { canonical: 'gal', name: '加仑(美制)', dim: 'volume', factor: 3.785411784 },
  ],
  time: [
    { canonical: 'year', name: '年', dim: 'time', factor: 31536000, approx: true },
    { canonical: 'month', name: '月', dim: 'time', factor: 2592000, approx: true },
    { canonical: 'week', name: '周', dim: 'time', factor: 604800 },
    { canonical: 'day', name: '天', dim: 'time', factor: 86400 },
    { canonical: 'h', name: '小时', dim: 'time', factor: 3600 },
    { canonical: 'min', name: '分钟', dim: 'time', factor: 60 },
    { canonical: 's', name: '秒', dim: 'time', factor: 1 },
    { canonical: 'ms', name: '毫秒', dim: 'time', factor: 1e-3 },
  ],
  currency: [],
}

export interface AliasDef {
  canonical: string
  dim: Dim
  /** 歧义消解权重（越大越优先），默认 0 */
  weight?: number
}

const a = (canonical: string, dim: Dim, weight = 0): AliasDef => ({ canonical, dim, weight })

/** 别名 → 规范单位（含中/英/符号多别名；币种代码与中文名也在此，供词法后置识别） */
export const ALIASES: Record<string, AliasDef> = {
  // 长度 length
  km: a('km', 'length'), 千米: a('km', 'length'), 公里: a('km', 'length'),
  m: a('m', 'length', 5), 米: a('m', 'length'), 公尺: a('m', 'length'),
  cm: a('cm', 'length'), 厘米: a('cm', 'length'), 公分: a('cm', 'length'),
  mm: a('mm', 'length'), 毫米: a('mm', 'length'),
  in: a('in', 'length'), inch: a('in', 'length'), inches: a('in', 'length'), 英寸: a('in', 'length'), '"': a('in', 'length'),
  ft: a('ft', 'length'), foot: a('ft', 'length'), feet: a('ft', 'length'), 英尺: a('ft', 'length'), "'": a('ft', 'length'),
  yd: a('yd', 'length'), yard: a('yd', 'length'), yards: a('yd', 'length'), 码: a('yd', 'length'),
  mi: a('mi', 'length'), mile: a('mile', 'length'), miles: a('mi', 'length'), 英里: a('mi', 'length'),
  里: a('里', 'length', 1), 华里: a('里', 'length'),
  尺: a('尺', 'length', 1), 市尺: a('尺', 'length'),
  寸: a('寸', 'length', 1), 市寸: a('寸', 'length'),
  // 重量 weight
  t: a('t', 'weight'), tonne: a('t', 'weight'), tonnes: a('t', 'weight'), 吨: a('t', 'weight'),
  kg: a('kg', 'weight'), 千克: a('kg', 'weight'), 公斤: a('kg', 'weight'),
  g: a('g', 'weight'), 克: a('g', 'weight'),
  mg: a('mg', 'weight'), 毫克: a('mg', 'weight'),
  μg: a('μg', 'weight'), ug: a('μg', 'weight'), 微克: a('μg', 'weight'),
  lb: a('lb', 'weight'), lbs: a('lb', 'weight'), 磅: a('lb', 'weight'),
  oz: a('oz', 'weight'), 盎司: a('oz', 'weight'),
  斤: a('斤', 'weight', 1),
  两: a('两', 'weight', 1),
  // 数据量 data（1000 进制，大小写都收）
  TB: a('TB', 'data'), tb: a('TB', 'data'),
  GB: a('GB', 'data'), gb: a('GB', 'data'),
  MB: a('MB', 'data'), mb: a('MB', 'data'),
  KB: a('KB', 'data'), kb: a('KB', 'data'),
  B: a('B', 'data', 5), b: a('B', 'data', 1),
  // 温度 temperature
  '℃': a('℃', 'temperature'), '°C': a('℃', 'temperature'), 摄氏度: a('℃', 'temperature'),
  '℉': a('℉', 'temperature'), '°F': a('℉', 'temperature'), 华氏度: a('℉', 'temperature'),
  K: a('K', 'temperature', 1), 开尔文: a('K', 'temperature'),
  // 面积 area
  '㎡': a('㎡', 'area'), 'm²': a('㎡', 'area'), 平方米: a('㎡', 'area'),
  'km²': a('km²', 'area'), 平方公里: a('km²', 'area'),
  ha: a('ha', 'area'), 公顷: a('ha', 'area'),
  亩: a('亩', 'area', 1),
  平方尺: a('平方尺', 'area'), '尺²': a('平方尺', 'area'),
  'ft²': a('ft²', 'area'), sqft: a('ft²', 'area'), 平方英尺: a('ft²', 'area'),
  英亩: a('英亩', 'area'), acre: a('英亩', 'area'), acres: a('英亩', 'area'),
  // 体积 volume
  L: a('L', 'volume', 2), l: a('L', 'volume', 1), 升: a('L', 'volume'),
  mL: a('mL', 'volume'), ml: a('mL', 'volume'), 毫升: a('mL', 'volume'),
  'm³': a('m³', 'volume'), 立方米: a('m³', 'volume'),
  'cm³': a('cm³', 'volume'), cc: a('cm³', 'volume'), 立方厘米: a('cm³', 'volume'),
  gal: a('gal', 'volume'), gallon: a('gal', 'volume'), gallons: a('gal', 'volume'), 加仑: a('gal', 'volume'),
  // 时间 time
  ms: a('ms', 'time'), 毫秒: a('ms', 'time'),
  s: a('s', 'time'), sec: a('s', 'time'), secs: a('s', 'time'), second: a('s', 'time'), seconds: a('s', 'time'), 秒: a('s', 'time'),
  min: a('min', 'time'), mins: a('min', 'time'), minute: a('min', 'time'), minutes: a('min', 'time'), 分钟: a('min', 'time'), 分: a('min', 'time'),
  h: a('h', 'time'), hr: a('h', 'time'), hrs: a('h', 'time'), hour: a('h', 'time'), hours: a('h', 'time'), 小时: a('h', 'time'), 时: a('h', 'time'),
  day: a('day', 'time'), days: a('day', 'time'), d: a('day', 'time'), 天: a('day', 'time'), 日: a('day', 'time'),
  week: a('week', 'time'), weeks: a('week', 'time'), wk: a('week', 'time'), 周: a('week', 'time'), 星期: a('week', 'time'),
  month: a('month', 'time'), months: a('month', 'time'), 月: a('month', 'time'),
  year: a('year', 'time'), years: a('year', 'time'), yr: a('year', 'time'), 年: a('year', 'time'),
  // 货币 currency（供后置词识别；换算走 money.ts）
  USD: a('USD', 'currency'), usd: a('USD', 'currency'), 美元: a('USD', 'currency'),
  CNY: a('CNY', 'currency'), cny: a('CNY', 'currency'), 人民币: a('CNY', 'currency'), 元: a('CNY', 'currency', 1),
  EUR: a('EUR', 'currency'), eur: a('EUR', 'currency'), 欧元: a('EUR', 'currency'),
  GBP: a('GBP', 'currency'), gbp: a('GBP', 'currency'), 英镑: a('GBP', 'currency'),
  JPY: a('JPY', 'currency'), jpy: a('JPY', 'currency'), 日元: a('JPY', 'currency'), 円: a('JPY', 'currency'),
  HKD: a('HKD', 'currency'), hkd: a('HKD', 'currency'), 港币: a('HKD', 'currency'),
  AUD: a('AUD', 'currency'), aud: a('AUD', 'currency'), 澳元: a('AUD', 'currency'),
  CAD: a('CAD', 'currency'), cad: a('CAD', 'currency'), 加元: a('CAD', 'currency'),
  SGD: a('SGD', 'currency'), sgd: a('SGD', 'currency'), 新加坡元: a('SGD', 'currency'),
  CHF: a('CHF', 'currency'), chf: a('CHF', 'currency'), 瑞郎: a('CHF', 'currency'), 瑞士法郎: a('CHF', 'currency'),
}

export const MAX_ALIAS_LEN: number = Math.max(0, ...Object.keys(ALIASES).map((k) => k.length))

export function findUnit(dim: Dim, canonical: string): UnitDef | undefined {
  return UNITS[dim].find((u) => u.canonical === canonical)
}
