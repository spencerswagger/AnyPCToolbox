// 身份证号解析、校验与生成（纯函数，零依赖）
// 算法与发证地拼接规则参考 mumuy/idcard（passer-by.com，MIT License）
// https://github.com/mumuy/idcard
// 校验位算法：ISO 7064:1983.MOD 11-2（GB 11643-1999）

export type AreaMap = Record<string, string>

/** 区划数据中的占位名称：不参与下拉选项与生成候选 */
export const PLACEHOLDER_NAMES = new Set(['市辖区', '县', '省直辖县级行政区划', '省直辖单位'])

export type InvalidReason =
  | '格式错误'
  | '长度错误'
  | '非法日期'
  | '校验位错误'
  | '未知区划'
  | '暂不支持'

export interface IdInfo {
  valid: boolean
  reason?: InvalidReason
  /** 居民身份证 / 港澳台居民居住证 / ''（无法判断时） */
  type: string
  /** 发证地（省+市+区县拼接） */
  sign: string
  /** 出生日期 YYYY-MM-DD，非法日期时为 '' */
  birthday: string
  /** 男 / 女 / '' */
  sex: string
  /** 周岁；出生日期非法时为 null */
  age: number | null
}

export type Sex = '男' | '女'

export interface GenerateOptions {
  /** 生成数量，默认 10，钳制到 1..500 */
  count?: number
  /** 不填则随机 */
  sex?: Sex
  /** 不填则 0 */
  minAge?: number
  /** 不填则 100 */
  maxAge?: number
  /** 2 位（省）/4 位（市）/6 位（区县）区划码前缀，不填则全国 */
  areaCode?: string
}

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

/** 计算 17 位本体码的校验位（第 18 位） */
export function checksum(body: string): string {
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += Number(body[i]) * WEIGHTS[i]
  }
  return CHECK_CODES[sum % 11]
}

/** 15 位号码升 18 位（出生年前补 19、末位补校验位）；非 15 位数字返回 null */
export function upgrade15to18(id: string): string | null {
  if (!/^\d{15}$/.test(id)) return null
  const body = `${id.slice(0, 6)}19${id.slice(6)}`
  return body + checksum(body)
}

/** 归一化用户输入：trim、x 转大写、15 位转 18 位；无法归一化时返回原因 */
export function normalizeId(input: string): { id?: string; reason?: InvalidReason } {
  const s = input.trim().toUpperCase()
  if (/^\d{15}$/.test(s)) return { id: upgrade15to18(s) as string }
  if (/^\d{17}[0-9X]$/.test(s)) return { id: s }
  if (/^\d+$/.test(s)) return { reason: '长度错误' }
  return { reason: '格式错误' }
}

/** 周岁计算 */
function calcAge(birth: Date, now: Date): number {
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

/**
 * 解析 18 位身份证号（15 位请先经 normalizeId 转换）。
 * 判定优先级：格式错误 > 暂不支持(93 开头) > 非法日期 > 校验位错误 > 未知区划。
 * reason 为 未知区划 时仍尽量返回生日/性别/年龄；reason 为 非法日期 时不再返回生日等字段。
 */
export function parseId(id: string, areas: AreaMap, now: Date = new Date()): IdInfo {
  const info: IdInfo = { valid: false, type: '', sign: '', birthday: '', sex: '', age: null }

  if (!/^\d{17}[0-9X]$/.test(id)) {
    const s = id.trim()
    info.reason = /^\d+$/.test(s) ? '长度错误' : '格式错误'
    return info
  }

  const district = id.slice(0, 6)
  const province = `${district.slice(0, 2)}0000`
  const city = `${district.slice(0, 4)}00`
  const isHmt = /^(81|82|83)/.test(district)

  if (isHmt) {
    info.type = '港澳台居民居住证'
    info.sign = areas[province] ?? ''
  } else {
    info.type = '居民身份证'
    if (/^(11|12|31|50)/.test(district) || /^\d{2}90/.test(district)) {
      info.sign = (areas[province] ?? '') + (city !== district ? (areas[district] ?? '') : '')
    } else {
      info.sign =
        (areas[province] ?? '') +
        (province !== city ? (areas[city] ?? '') : '') +
        (city !== district ? (areas[district] ?? '') : '')
    }
  }

  const y = Number(id.slice(6, 10))
  const mo = Number(id.slice(10, 12))
  const d = Number(id.slice(12, 14))
  const date = new Date(y, mo - 1, d)
  const dateOk =
    mo >= 1 &&
    mo <= 12 &&
    d >= 1 &&
    d <= 31 &&
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d &&
    date.getTime() <= now.getTime()
  if (!dateOk) {
    info.reason = '非法日期'
    return info
  }
  info.birthday = `${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`
  info.sex = Number(id.charAt(16)) % 2 === 1 ? '男' : '女'
  info.age = calcAge(date, now)

  if (/^93/.test(district)) {
    info.reason = '暂不支持'
    return info
  }

  if (id.charAt(17) !== checksum(id.slice(0, 17))) {
    info.reason = '校验位错误'
    return info
  }

  const areaKnown = isHmt ? areas[province] !== undefined : areas[district] !== undefined
  if (!areaKnown) {
    info.reason = '未知区划'
    return info
  }

  info.valid = true
  return info
}

/**
 * 批量生成身份证号，生成结果保证校验位正确、出生日期合法。
 * 候选地址码 = 数据中可解析出名称的 6 位码，排除省市占位码（末两位 00）、
 * 占位名称、港澳台（81/82/83）与外国人（93）段。
 */
export function generateIds(options: GenerateOptions, areas: AreaMap, now: Date = new Date()): string[] {
  const count = Math.max(1, Math.min(500, options.count ?? 10))
  const minAge = Math.max(0, Math.min(150, options.minAge ?? 0))
  const maxAge = Math.max(minAge, Math.min(150, options.maxAge ?? 100))

  let codes = Object.keys(areas).filter(
    (code) =>
      /^\d{6}$/.test(code) &&
      !code.endsWith('00') &&
      !PLACEHOLDER_NAMES.has(areas[code]) &&
      !/^(81|82|83|93)/.test(code),
  )
  if (options.areaCode) {
    const ac = options.areaCode
    // 按码的行政级别推导前缀长度：省码(XX0000)→2位，市码(XXXX00)→4位，区县码→6位
    const prefix =
      ac.length >= 6 && ac.endsWith('0000')
        ? ac.slice(0, 2)
        : ac.length >= 6 && ac.endsWith('00')
          ? ac.slice(0, 4)
          : ac.slice(0, 6)
    codes = codes.filter((c) => c.startsWith(prefix))
  }
  if (codes.length === 0) return []

  const latest = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate())
  const earliest = new Date(now.getFullYear() - (minAge + 1), now.getMonth(), now.getDate() + 1)
  const span = latest.getTime() - earliest.getTime()

  const result: string[] = []
  const seen = new Set<string>()
  let guard = count * 20
  while (result.length < count && guard-- > 0) {
    const area = codes[Math.floor(Math.random() * codes.length)]!
    const dt = new Date(earliest.getTime() + Math.floor(Math.random() * (span + 1)))
    const ymd =
      `${dt.getFullYear()}` +
      `${String(dt.getMonth() + 1).padStart(2, '0')}` +
      `${String(dt.getDate()).padStart(2, '0')}`
    const wantOdd = options.sex ? options.sex === '男' : Math.random() < 0.5
    const seq = String(Math.floor(Math.random() * 500) * 2 + (wantOdd ? 1 : 0)).padStart(3, '0')
    const body = `${area}${ymd}${seq}`
    const id = body + checksum(body)
    if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}
