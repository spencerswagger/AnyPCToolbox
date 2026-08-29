<script setup lang="ts">
import type { ApiRequest, HttpMethod, KvItem } from '@/lib/debugger/model'
import FieldTip from './FieldTip.vue'
import KvRows from './KvRows.vue'
import { TooltipProvider } from 'radix-vue'

const props = defineProps<{ api: ApiRequest; dirty: boolean }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
  (e: 'save'): void
  (e: 'send'): void
}>()

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
const bodyTypes = ['none', 'json', 'form', 'text'] as const

function patch(p: Partial<ApiRequest>) {
  emit('update', { ...props.api, ...p })
}

// ---- 从 URL 导入查询参数：拆出 ? 之后的部分加入 query，并从 URL 移除 ----
function importFromUrl() {
  const raw = props.api.urlTemplate
  const qi = raw.indexOf('?')
  if (qi < 0) return
  const path = raw.slice(0, qi)
  const qs = raw.slice(qi + 1)
  const kv: KvItem[] = []
  new URLSearchParams(qs).forEach((v, k) => kv.push({ key: k, value: v, enabled: true }))
  if (!kv.length) return
  patch({ urlTemplate: path || '', query: [...props.api.query, ...kv] })
}

// 方法 -> 工业配色类
function mCls(m: HttpMethod): string {
  const map: Record<string, string> = {
    GET: 'httpd-m-get', POST: 'httpd-m-post', PUT: 'httpd-m-put',
    PATCH: 'httpd-m-patch', DELETE: 'httpd-m-delete',
    HEAD: 'httpd-m-head', OPTIONS: 'httpd-m-options',
  }
  return map[m] ?? 'httpd-m-options'
}
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <select
          :value="api.method" @change="patch({ method: ($event.target as HTMLSelectElement).value as HttpMethod })"
          class="h-8 rounded border border-border bg-background px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="mCls(api.method)"
        >
          <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
        </select>
        <input
          class="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="URL 模板，支持 {{var}}"
          :title="'请求地址模板。其中的 {{变量名}} 会在发送时被「调试」页的变量输入框替换；也可写入分页参数占位如 {{page}}，翻页时会覆盖该值。'"
          :value="api.urlTemplate"
          @input="patch({ urlTemplate: ($event.target as HTMLInputElement).value })"
        />
        <span v-if="dirty" class="shrink-0 font-mono text-[10px] font-bold text-warning" title="当前接口有未保存的修改：点右侧「保存」写入本地">● 未保存</span>
        <button
          class="shrink-0 rounded border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!dirty" :title="'把当前接口的请求配置、解析与分页规则保存到本地'" @click="emit('save')"
        >保存</button>
        <button
          class="httpd-btn httpd-btn-accent shrink-0 rounded px-2.5 py-1 text-xs"
          :title="'按当前接口发送请求并记录到历史（自动跳到「调试」页查看结果）'" @click="emit('send')"
        >发送</button>
      </div>

      <div class="httpd-panel overflow-hidden">
        <div class="flex items-center gap-1.5 px-3 py-2">
          <span class="httpd-eyebrow text-foreground">查询参数</span>
          <FieldTip>请求问号之后拼接的参数。若开启分页，翻页时 key 与「分页参数名」相同的项会被自动覆盖。</FieldTip>
          <button class="ml-auto httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" title="把 URL 中问号之后的参数拆出来，添加到下方查询列表，并自动从 URL 中移除" @click="importFromUrl">从 URL 导入</button>
        </div>
        <div class="border-t border-border p-3">
          <KvRows :rows="api.query" @update="patch({ query: $event })" />
        </div>
      </div>

      <div class="httpd-panel overflow-hidden">
        <div class="flex items-center gap-1.5 px-3 py-2">
          <span class="httpd-eyebrow text-foreground">请求头</span>
          <FieldTip>随请求一起发送的 HTTP 请求头，常用于认证（Authorization）、Content-Type 等。</FieldTip>
        </div>
        <div class="border-t border-border p-3">
          <KvRows :rows="api.headers" @update="patch({ headers: $event })" />
        </div>
      </div>

      <div class="httpd-panel overflow-hidden">
        <div class="flex items-center gap-1.5 px-3 py-2">
          <span class="httpd-eyebrow text-foreground">请求体</span>
          <FieldTip>选择内容类型：json（多行文本，自动带 Content-Type: application/json）／form（条目化 key=value，自动拼装为表单并带 x-www-form-urlencoded）／text（多行纯文本）。其中的 &#123;&#123;var}} 占位符会被提取为变量。</FieldTip>
        </div>
        <div class="space-y-2 border-t border-border p-3">
          <div class="flex flex-wrap gap-1">
            <button v-for="bt in bodyTypes" :key="bt" @click="patch({ bodyType: bt })"
              class="httpd-chip" :class="api.bodyType === bt ? 'httpd-chip-bg text-foreground' : 'text-muted-foreground'">{{ bt }}</button>
          </div>
          <!-- form 类型：条目化 key=value 配置 -->
          <div v-if="api.bodyType === 'form'">
            <KvRows :rows="api.form" @update="patch({ form: $event })" />
          </div>
          <!-- json / text：多行文本 -->
          <textarea
            v-else
            class="h-40 w-full rounded border border-border bg-background p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="请求体内容（{{var}} 会被提取）"
            :value="api.bodyText"
            @input="patch({ bodyText: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>