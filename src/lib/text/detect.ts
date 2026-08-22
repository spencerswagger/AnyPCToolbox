// 输入类型探测（纯函数，零依赖）

export type DetectedType = 'json' | 'url' | 'base64' | 'uuid' | 'timestamp' | 'hex' | 'generic'

function tryJson(s: string): boolean {
  try {
    JSON.parse(s)
    return true
  } catch {
    return false
  }
}

/** 探测主类型：json / url / base64 / uuid / timestamp / hex / generic */
export function detectType(input: string): DetectedType {
  const s = input.trim()
  if (!s) return 'generic'
  // 纯数字的 10/13 位视为 Unix 时间戳（在 JSON 判断之前，避免被 number JSON 遮蔽）
  if (/^\d{10}$/.test(s) || /^\d{13}$/.test(s)) return 'timestamp'
  if (tryJson(s)) return 'json'
  if (typeof URL === 'function') {
    try {
      const u = new URL(s)
      if (/^https?:$/.test(u.protocol)) return 'url'
    } catch {
      // 非 URL，继续
    }
  }
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) return 'uuid'
  // Base64：长度 ≥ 4 的倍数（或带 1-2 个 = 填充），禁空白
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(s) && s.length >= 4 && s.length % 4 === 0) return 'base64'
  if (/^[0-9a-fA-F]+$/.test(s) && s.length >= 2) return 'hex'
  return 'generic'
}