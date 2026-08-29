# 用户意见反馈功能设计

日期：2026-08-29
状态：已确认
归属：全局（AppLayout 头部入口，覆盖所有页面）
路线：纯前端 + 飞书多维表格工作流 Webhook（不引入后端服务）

## 背景与目标

AnyPCToolbox 是纯前端、离线优先、无后端的桌面（Tauri）+ Web 应用。用户希望能**在应用内**提交问题/意见/商务咨询，且部分场景需要**触达客户**（收集联系方式），要求提交过程不跳出应用。

已确认的关键决策：

* **渠道**：飞书多维表格工作流「接收到 webhook 时」触发器。前端直接 POST 到飞书 webhook 地址，触发自动化流程在表格中新增记录，可同时发飞书消息通知。无需 App Secret / 云函数。

* **入口**：A 方案——顶部导航栏图标按钮（header 右侧、主题切换旁）。

* **配置**：不硬编码请求地址，代码读 `import.meta.env.VITE_FEEDBACK_WEBHOOK_URL`，由 GitHub Actions 用仓库变量 `vars.FEEDBACK_WEBHOOK_URL` 注入（对齐现有 `UPDATER_BASE_URL` 注入模式）。

* **字段**：类型 / 内容（必填）/ 联系方式（选填强提示）/ 同意联系（勾选）。

## 数据流

```
应用内反馈弹窗（Vue Dialog）
  → fetch POST JSON（飞书 webhook 格式，Content-Type: application/json）
  → 飞书多维表格「工作流」webhook 触发器
  → 自动化「新增记录」到多维表格 + （可选）「发送飞书消息通知」
  → 前端收到响应，toast 提示 成功/失败
```

## 配置注入（不固定请求地址）

* 新增 `src/lib/feedback/config.ts`：

  ```ts
  export const FEEDBACK_WEBHOOK_URL = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as string | undefined
  export const FEEDBACK_WEBHOOK_TOKEN = import.meta.env.VITE_FEEDBACK_WEBHOOK_TOKEN as string | undefined
  ```

  * 缺失（本地开发 / 未配置变量）时提交按钮仍可点，提交前检测为空则 toast 提示"反馈通道未配置，请联系管理员"，不发起请求。

* 新增 `.env.example`（含 `VITE_FEEDBACK_WEBHOOK_URL` / `VITE_FEEDBACK_WEBHOOK_TOKEN` 占位与注释）。本地开发默认无值。

* [release.yml](/workspace/.github/workflows/release.yml) 两个 job 的构建步骤注入环境变量：

  * `publish-tauri`：`tauri-action` 步骤 `env` 增加 `VITE_FEEDBACK_WEBHOOK_URL: ${{ vars.FEEDBACK_WEBHOOK_URL }}`、`VITE_FEEDBACK_WEBHOOK_TOKEN: ${{ vars.FEEDBACK_WEBHOOK_TOKEN }}`

  * `upload-web`：`npm run build` 步骤 `env` 增加同两项

* 仓库需配置变量 `FEEDBACK_WEBHOOK_URL`（必填）与 `FEEDBACK_WEBHOOK_TOKEN`（选填，启用 token 时）。

## 前端组件

新增 `src/components/FeedbackDialog.vue`（基于 radix-vue `Dialog`，沿用 shadcn 风格，与现有组件一致）：

| 字段   | 类型     | 规则                                                 |
| ---- | ------ | -------------------------------------------------- |
| 类型   | 单选     | 问题反馈 / 功能建议 / 商务咨询 / 其他                            |
| 内容   | 多行文本   | 必填，trim 后非空，上限 2000 字（maxlength）                   |
| 联系方式 | 文本（单行） | 选填；placeholder 提示"邮箱 / 微信 / 手机号"；带说明"填写后我们可能联系您跟进" |
| 同意联系 | 勾选     | 默认选中；说明文案"联系方式仅用于回复您的反馈，不会用于其他用途"                  |

行为：

* 提交：校验 → POST 扁平 JSON body `{ type, content, contact, consent }`（飞书工作流 webhook 触发器可按此结构配置输出 schema，供后续「新增记录」节点引用字段）；开启 token 时带 `Authorization: Bearer <token>` → 成功 toast（复用 [use-toast.ts](/workspace/src/lib/ui/use-toast.ts) / [Toaster.vue](/workspace/src/components/ui/Toaster.vue)）→ 关闭并重置表单；失败 toast 且保留用户输入。

* 防滥用：前端限制两次提交最小间隔 30 秒（提交后禁用按钮并倒计时），内容长度校验兜底。

* 错误处理：未配置 webhook / 网络失败 / 非 2xx / 频繁提交，均 toast 提示，不打断当前操作。

入口改动 [AppLayout.vue](/workspace/src/components/AppLayout.vue)：

* header 右侧 `div.flex.items-center.gap-2` 内、`ThemeToggle` 旁加"反馈"图标按钮（lucide 图标，如 `MessageSquarePlus` 或 `MessageCircle`），点击打开 FeedbackDialog。

## 飞书侧配置（一次性，写入实施文档）

1. 新建多维表格，字段：`类型`（单选）/ `内容`（多行文本）/ `联系方式`（文本）/ `是否同意联系`（勾选）；`创建时间` 由飞书自动记录。
2. 新建「工作流」：触发器 = 接收到 webhook 时；操作 = 新增记录；可再添一步「发送飞书消息通知」给反馈人。
3. 复制 webhook 地址；如需鉴权，开启 Bearer token 并复制 token。
4. 将地址 / token 填入仓库 Settings → Variables。

## 验证要点（实现时必须实测）

* **CORS（唯一可能推翻纯前端的风险点）**：桌面端 webview / 浏览器向飞书 webhook 跨域 POST 是否被 CORS 拦截。实现时先做 spike：从 dev server 页面直接 fetch 该 webhook 验证响应头。若被拦截，退回「极简云函数转发」方案（其余设计不变），并在此文档补充附录说明。

* 构建后确认注入值生效（`npm run build` 产物中 URL 被替换）。

* 提交成功后在多维表格看到新记录、收到通知（若配置）。

