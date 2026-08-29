// 反馈逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-feedback.ts
import {
  FEEDBACK_TYPES,
  buildFeedbackPayload,
  validateFeedback,
  submitFeedback,
  type FeedbackPayload,
  type FeedbackForm,
} from '../src/lib/feedback/feedback.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('buildFeedbackPayload')
const form: FeedbackForm = { type: 'bug', content: '  空白内容  ', contact: '  foo@bar.com  ', consent: true }
const payload = buildFeedbackPayload(form)
check('trim 内容与联系方式', payload.content === '空白内容' && payload.contact === 'foo@bar.com', `${payload.content}|${payload.contact}`)
check('透传类型与同意项', payload.type === 'bug' && payload.consent === true)

console.log('validateFeedback')
check('空内容 → 报错', validateFeedback({ type: 'bug', content: '  ', contact: '', consent: true }) !== null)
check('超长内容 → 报错', validateFeedback({ type: 'bug', content: 'x'.repeat(2001), contact: '', consent: true }) !== null)
check('正常输入 → 通过', validateFeedback({ type: 'suggestion', content: '建议增加导出', contact: '', consent: true }) === null)
check('超长联系方式 → 报错', validateFeedback({ type: 'bug', content: 'ok', contact: 'x'.repeat(201), consent: true }) !== null)
check('FEEDBACK_TYPES 含四类', FEEDBACK_TYPES.map((t) => t.value).join(',') === 'bug,suggestion,business,other', FEEDBACK_TYPES.map((t) => t.label).join(','))

console.log('submitFeedback')
const okPayload: FeedbackPayload = { type: 'bug', content: '报错了', contact: '', consent: true }
check(
  'HTTP 200 → ok:true',
  (await submitFeedback({ url: 'https://example.test/webhook', payload: okPayload, fetchFn: async () => new Response('', { status: 200 }) })).ok === true,
)
check(
  'HTTP 500 → ok:false 且带错误信息',
  (await (async () => { const r = await submitFeedback({ url: 'https://example.test/webhook', payload: okPayload, fetchFn: async () => new Response('', { status: 500 }) }); return !r.ok && typeof r.error === 'string' })()) === true,
)
check(
  '网络异常 → ok:false',
  (await (async () => { const r = await submitFeedback({ url: 'https://example.test/webhook', payload: okPayload, fetchFn: async () => { throw new TypeError('network down') } }); return !r.ok })()) === true,
)
check(
  '携带 Bearer token',
  (await (async () => {
    let auth = ''
    await submitFeedback({
      url: 'https://example.test/webhook',
      token: 'secret-token',
      payload: okPayload,
      fetchFn: async (_url, init) => { auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? ''; return new Response('', { status: 200 }) },
    })
    return auth === 'Bearer secret-token'
  })()) === true,
)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
