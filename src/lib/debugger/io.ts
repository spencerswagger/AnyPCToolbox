import type { ApiRequest } from './model.ts'
import { createApiRequest } from './model.ts'

export function exportApi(api: ApiRequest): string {
  return JSON.stringify(api, null, 2)
}

export function importApi(text: string): ApiRequest | null {
  try {
    const obj = JSON.parse(text) as Partial<ApiRequest>
    return createApiRequest(obj)
  } catch {
    return null
  }
}