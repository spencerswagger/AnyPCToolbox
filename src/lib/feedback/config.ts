// 构建时由 GitHub Actions 以仓库变量注入（VITE_FEEDBACK_WEBHOOK_URL / VITE_FEEDBACK_WEBHOOK_TOKEN）。
// 本地开发未配置时为空串，提交前由组件提示"反馈通道未配置"。
export const FEEDBACK_WEBHOOK_URL = (import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as string | undefined) ?? ''
export const FEEDBACK_WEBHOOK_TOKEN = (import.meta.env.VITE_FEEDBACK_WEBHOOK_TOKEN as string | undefined) ?? ''
