/**
 * 操作系统与芯片架构检测引擎（纯前端，离线可用）
 *
 * 逻辑源自 offline 工具「你的电脑信息检测」，移植为纯函数以便复用与测试。
 * - 操作系统：优先取 navigator.userAgentData.platform，回退 navigator.platform / userAgent。
 * - 芯片架构：
 *   1. Chromium 内核浏览器：请求 userAgentData.getHighEntropyValues(['architecture'])，最准；
 *   2. 其他浏览器：getHighEntropyValues 不可用，无法可靠识别，回退为「识别失败」。
 */

export type OsName = 'Windows' | 'macOS' | 'Linux' | 'Other'
export type Arch = 'amd64' | 'arm64' | 'x86' | string | null

export interface ArchOsResult {
  /** 识别出的操作系统 */
  os: OsName
  /** 识别出的架构；null 表示无法识别 */
  arch: Arch
  /** arch 是否来自高熵接口，为 true 时结果可信 */
  reliable: boolean
  /** 是否 Chromium 内核浏览器（决定能否请求高熵接口） */
  chromium: boolean
}

/** UA 里 platform / userAgentData.platform 归一化为操作系统名称 */
export function normalizeOS(platform: string | undefined): OsName {
  const s = String(platform ?? '').toLowerCase()
  if (s.indexOf('win') !== -1) return 'Windows'
  if (s.indexOf('mac') !== -1) return 'macOS'
  if (s.indexOf('linux') !== -1 || s.indexOf('x11') !== -1) return 'Linux'
  return 'Other'
}

/** 架构原始字符串归一化为约定标签；无法归一则原样返回 */
export function normalizeArch(a: string | undefined): Arch {
  if (!a) return null
  const s = String(a).toLowerCase()
  if (s === 'x86-64' || s === 'x64' || s === 'amd64') return 'amd64'
  if (s === 'arm64' || s === 'arm') return 'arm64'
  if (s === 'x86' || s === 'ia-32') return 'x86'
  return s
}

/** 是否为 Chromium 内核（Chrome/Edge/龙芯/麒麟/统信等基于 Chromium 的国产浏览器） */
export function isChromium(userAgent: string | undefined, brands: Array<{ brand?: string }> | undefined): boolean {
  for (const b of brands ?? []) {
    if (String((b && b.brand) || '').toLowerCase().indexOf('chromium') !== -1) return true
  }
  const ua = String(userAgent ?? '').toLowerCase()
  return ua.indexOf('chromium') !== -1 || ua.indexOf('chrome/') !== -1
}

/**
 * 综合检测。同步部分先算出 OS 与是否 Chromium；
 * 若可用则异步请求高熵接口补全架构，返回 Promise<ArchOsResult>。
 */
export function detect(
  nav: {
    userAgentData?: {
      platform?: string
      brands?: Array<{ brand?: string }>
      getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>
    }
    platform?: string
    userAgent?: string
  } = {},
): Promise<ArchOsResult> {
  const os = normalizeOS((nav.userAgentData && nav.userAgentData.platform) || nav.platform || nav.userAgent)
  const chromium = isChromium(nav.userAgent, nav.userAgentData && nav.userAgentData.brands)
  const resolved: ArchOsResult = { os, arch: null, reliable: false, chromium }

  if (chromium && nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === 'function') {
    return nav.userAgentData
      .getHighEntropyValues(['architecture'])
      .then((hv) => {
        if (hv && hv.architecture) {
          resolved.arch = normalizeArch(hv.architecture)
          resolved.reliable = true
        }
        return resolved
      })
      .catch(() => resolved)
  }
  return Promise.resolve(resolved)
}

/** 操作系统展示名 */
export const OS_NAME: Record<OsName, string> = {
  Windows: 'Windows',
  macOS: 'macOS',
  Linux: 'Linux',
  Other: '其他系统',
}

/** 架构展示名（含通俗说明） */
export const ARCH_LABEL: Record<string, string> = {
  amd64: 'amd64（x64 / x86-64）',
  arm64: 'arm64',
  x86: 'x86（32 位）',
}