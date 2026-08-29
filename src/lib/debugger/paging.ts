import type { ApiRequest, PagingConfig } from './model.ts'

export interface PagingPreset {
  key: string
  label: string
  mode: PagingConfig['mode']
  pageParam: string
  sizeParam: string
  offsetParam: string
  hint: string
}

// 主流分页风格预设：选择后自动填入参数名
export const PAGING_PRESETS: PagingPreset[] = [
  { key: 'page-pageSize', label: 'page / pageSize', mode: 'page', pageParam: 'page', sizeParam: 'pageSize', offsetParam: 'offset', hint: '最常见：页码+每页条数，Java / Spring 系接口常用' },
  { key: 'pageNumber-pageSize', label: 'pageNumber / pageSize', mode: 'page', pageParam: 'pageNumber', sizeParam: 'pageSize', offsetParam: 'offset', hint: 'MyBatis-Plus / 部分后台管理接口' },
  { key: 'page-size', label: 'page / size', mode: 'page', pageParam: 'page', sizeParam: 'size', offsetParam: 'offset', hint: 'Spring Data 等框架风格' },
  { key: 'page-per_page', label: 'page / per_page', mode: 'page', pageParam: 'page', sizeParam: 'per_page', offsetParam: 'offset', hint: 'GitHub / restful 风格 Web API' },
  { key: 'current-size', label: 'current / size', mode: 'page', pageParam: 'current', sizeParam: 'size', offsetParam: 'offset', hint: 'MyBatis-Plus 分页插件 page.current' },
  { key: 'limit-offset', label: 'limit / offset', mode: 'offset', pageParam: 'page', sizeParam: 'limit', offsetParam: 'offset', hint: '偏移游标分页：offset=(page-1)×limit' },
]

// 返回当前生效的分页配置；未开启则返回 null
export function effectivePaging(api: ApiRequest): PagingConfig | null {
  if (api.paging?.enabled) return api.paging
  // 兼容旧数据：模板含 page 变量视为 page / pageSize 分页
  if (api.variables.some((v) => v.name.toLowerCase() === 'page')) {
    return { enabled: true, mode: 'page', pageParam: 'page', sizeParam: 'pageSize', offsetParam: 'offset', size: 10 }
  }
  return null
}

// 根据当前页生成需要注入到请求的分页参数（query / 模板变量）
export function pagingParams(cfg: PagingConfig, page: number): Record<string, string> {
  const out: Record<string, string> = {}
  const size = cfg.size || 10
  if (cfg.mode === 'offset') {
    out[cfg.offsetParam || 'offset'] = String((Math.max(1, page) - 1) * size)
    out[cfg.sizeParam || 'limit'] = String(size)
  } else {
    out[cfg.pageParam || 'page'] = String(page)
    out[cfg.sizeParam || 'pageSize'] = String(size)
  }
  return out
}

export function presetToConfig(p: PagingPreset, size: number): PagingConfig {
  return { enabled: true, mode: p.mode, pageParam: p.pageParam, sizeParam: p.sizeParam, offsetParam: p.offsetParam, size }
}