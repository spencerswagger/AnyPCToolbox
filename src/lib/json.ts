export interface JsonValidationResult {
  valid: boolean
  error: string | null
  parsed: unknown | null
}

export function validateJson(input: string): JsonValidationResult {
  if (!input.trim()) {
    return { valid: true, error: null, parsed: null }
  }
  try {
    const parsed = JSON.parse(input)
    return { valid: true, error: null, parsed }
  } catch (e) {
    return { valid: false, error: (e as Error).message, parsed: null }
  }
}

export function formatJson(input: string, indent: number = 2): string {
  const parsed = JSON.parse(input)
  return JSON.stringify(parsed, null, indent)
}

export function compressJson(input: string): string {
  const parsed = JSON.parse(input)
  return JSON.stringify(parsed)
}

export function syntaxHighlightJson(obj: unknown, depth: number = 0): string {
  if (obj === null) return '<span class="json-null">null</span>'
  if (obj === undefined) return ''

  const indent = '  '
  const pad = (n: number) => indent.repeat(n)

  if (typeof obj === 'string') {
    return `<span class="json-string">"${escapeHtml(obj)}"</span>`
  }
  if (typeof obj === 'number') {
    return `<span class="json-number">${obj}</span>`
  }
  if (typeof obj === 'boolean') {
    return `<span class="json-boolean">${obj}</span>`
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '<span class="json-bracket">[ ]</span>'
    const items = obj.map((item) =>
      `${pad(depth + 1)}${syntaxHighlightJson(item, depth + 1)}`
    ).join(',\n')
    return `[\n${items}\n${pad(depth)}]`
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>)
    if (keys.length === 0) return '<span class="json-bracket">{ }</span>'
    const items = keys.map((key) => {
      const value = (obj as Record<string, unknown>)[key]
      return `${pad(depth + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: ${syntaxHighlightJson(value, depth + 1)}`
    }).join(',\n')
    return `{\n${items}\n${pad(depth)}}`
  }

  return String(obj)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}