export const FEEDBACK_TYPES = [
  { value: 'bug', label: '问题反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'business', label: '商务咨询' },
  { value: 'other', label: '其他' },
] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]['value']

export const CONTENT_MAX_LENGTH = 2000
export const CONTACT_MAX_LENGTH = 200

export interface FeedbackForm {
  type: FeedbackType
  content: string
  contact: string
  consent: boolean
}

// 飞书工作流 Webhook 期望的扁平 JSON 载荷
export interface FeedbackPayload {
  type: FeedbackType
  content: string
  contact: string
  consent: boolean
}

export function buildFeedbackPayload(form: FeedbackForm): FeedbackPayload {
  return {
    type: form.type,
    content: form.content.trim(),
    contact: form.contact.trim(),
    consent: form.consent,
  }
}

export function validateFeedback(payload: FeedbackPayload): string | null {
  if (!payload.content.trim()) return '请填写反馈内容'
  if (payload.content.length > CONTENT_MAX_LENGTH) return `内容不能超过 ${CONTENT_MAX_LENGTH} 字`
  if (payload.contact.length > CONTACT_MAX_LENGTH) return `联系方式不能超过 ${CONTACT_MAX_LENGTH} 字`
  return null
}

export interface SubmitResult {
  ok: boolean
  error?: string
}

export async function submitFeedback(opts: {
  url: string
  token?: string
  payload: FeedbackPayload
  fetchFn?: typeof fetch
}): Promise<SubmitResult> {
  const { url, token, payload, fetchFn = fetch } = opts
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, error: `提交失败（HTTP ${res.status}），请稍后重试` }
    return { ok: true }
  } catch {
    return { ok: false, error: '网络异常，反馈提交失败，请稍后重试' }
  }
}
