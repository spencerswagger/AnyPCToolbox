# 新工具开发约定

新工具只需在**观感**和**操作习惯**上跟现有工具（`Json.vue`、`Markdown.vue`）保持一致，具体实现、目录、命名不强约束。

## 一、风格样式

1. **颜色只用语义 token，不写死色值**：`text-foreground` / `text-muted-foreground` / `bg-card` / `bg-background` / `border-border` / `bg-accent` / `bg-destructive` / `bg-primary`，这样暗色模式自动生效。
2. **按钮两种样式**（大致一致即可）：
   - 主操作：`bg-primary text-primary-foreground hover:bg-primary/90`
   - 次操作：`border border-input bg-background hover:bg-accent`
   - 公共：`rounded-md text-sm font-medium transition-colors`
3. **面板统一观感**：`rounded-lg border` 的卡片，配 `border-b` 的标题栏 + `text-xs uppercase tracking-wider` 小标题。
4. **可访问性习惯**：交互元素带 `focus-visible:ring-2 focus-visible:ring-ring` 与 `outline-none`。
5. **暗色模式**：新引入的颜色必须补 `.dark` 变体，保证两种主题都正常。

## 二、交互逻辑

1. **页面大框架**：顶部「← 返回 + 工具名 + 右侧操作按钮（复制/导入/导出）」→ 主内容区 → 底部状态栏。不是所有工具都需要这一步，按需保留。
2. **响应式**：左右分栏用 `grid md:grid-cols-2`，移动端自动堆叠。
3. **通用操作写法沿用即可**（不必强行照抄）：
   - 导入：`<input type="file">` + `FileReader`
   - 导出：`Blob` + `URL.createObjectURL` + `<a download>`
   - 复制：`navigator.clipboard.writeText` + `try/catch`
4. **错误提示**：用 `border-destructive/50 bg-destructive/10 text-destructive` 横幅，带 ⚠️ 图标。
5. **状态反馈**：底部状态栏显示校验状态 + 统计信息。