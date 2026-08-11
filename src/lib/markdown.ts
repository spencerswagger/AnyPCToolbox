import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="not-prose"><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // fall through
      }
    }
    return `<pre class="not-prose"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

export function renderMarkdown(source: string): string {
  return md.render(source)
}

export function renderMarkdownSafe(source: string): string {
  if (!source) return '<p style="color: var(--muted-foreground)">输入 Markdown 文本开始预览...</p>'
  return renderMarkdown(source)
}