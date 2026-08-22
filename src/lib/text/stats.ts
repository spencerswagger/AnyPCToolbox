// 文本统计（纯函数，零依赖）
// 字符/字节/行/词计数；emoji 等 astral 字符按 code point 正确统计，不歪曲。

export interface TextStats {
  /** UTF-16 code units（JS string.length 语义） */
  chars: number
  /** Unicode code points（emoji 算 1） */
  codePoints: number
  /** UTF-8 编码字节数 */
  bytesUtf8: number
  /** UTF-16 编码字节数（code units × 2） */
  bytesUtf16: number
  /** 行数（按 \r?\n 拆分后长度） */
  lines: number
  /** 非空行数 */
  nonEmptyLines: number
  /** 单词数（按空白分隔；零空白视为 1） */
  words: number
  /** 非 ASCII 字符数（近似英文维度参考） */
  nonAscii: number
}

const utf8Encoder = new TextEncoder()

/** 统计一段文本；空字符串返回全 0 计数 */
export function computeStats(input: string): TextStats {
  if (input.length === 0) {
    return { chars: 0, codePoints: 0, bytesUtf8: 0, bytesUtf16: 0, lines: 0, nonEmptyLines: 0, words: 0, nonAscii: 0 }
  }
  const codePoints = Array.from(input)
  const lines = input.split(/\r?\n/)
  const words = input.trim() ? input.trim().split(/\s+/).length : 0
  let nonAscii = 0
  for (const ch of codePoints) if (ch.charCodeAt(0) > 127) nonAscii++
  return {
    chars: input.length,
    codePoints: codePoints.length,
    bytesUtf8: utf8Encoder.encode(input).length,
    bytesUtf16: input.length * 2,
    lines: lines.length,
    nonEmptyLines: lines.filter((l) => l.trim() !== '').length,
    words,
    nonAscii,
  }
}