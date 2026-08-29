<script setup lang="ts">
import { createApiRequest } from '@/lib/debugger/model'
import type { ApiRequest } from '@/lib/debugger/model'
import { getApis, saveApis, getGlobals, saveGlobals } from '@/lib/debugger/db'
import ConfigPanel from '@/components/debugger/ConfigPanel.vue'
import RunPanel from '@/components/debugger/RunPanel.vue'
import HistoryPanel from '@/components/debugger/HistoryPanel.vue'
import EnvPanel from '@/components/debugger/EnvPanel.vue'
import { computed, onMounted, ref } from 'vue'

const apis = ref<Record<string, ApiRequest>>({})
const currentId = ref<string>('')
const activeTab = ref<'config' | 'run' | 'history'>('config')
const globals = ref<Record<string, string>>({})
const showEnv = ref(false)
const renamingId = ref('')
const renameText = ref('')
const collapsed = ref(false)

const currentApi = computed<ApiRequest | undefined>(() => apis.value[currentId.value])

onMounted(async () => {
  apis.value = await getApis()
  globals.value = await getGlobals()
  const first = Object.keys(apis.value)[0]
  if (first) currentId.value = first
  else {
    const a = createApiRequest()
    apis.value = { [a.id]: a }
    currentId.value = a.id
    await saveApis(apis.value)
  }
})

function save(api: ApiRequest) {
  apis.value = { ...apis.value, [api.id]: api }
  void saveApis(apis.value)
}
function select(id: string) { currentId.value = id }
function setGlobals(g: Record<string, string>) { globals.value = g; void saveGlobals(g) }
function onImport(api: ApiRequest) {
  apis.value = { ...apis.value, [api.id]: api }
  currentId.value = api.id
  void saveApis(apis.value)
  showEnv.value = false
}

// ---- 左栏：新建 / 重命名 / 删除 ----
function createApi() {
  const a = createApiRequest({ name: `新接口 ${Object.keys(apis.value).length + 1}` })
  apis.value = { ...apis.value, [a.id]: a }
  currentId.value = a.id
  void saveApis(apis.value)
}
function startRename(id: string) {
  renamingId.value = id
  renameText.value = apis.value[id]?.name ?? ''
}
function commitRename() {
  const id = renamingId.value
  renamingId.value = ''
  if (id && apis.value[id]) {
    const name = renameText.value.trim()
    if (name && name !== apis.value[id].name) save({ ...apis.value[id], name })
    else if (!name) { const n = apis.value[id].name; if (n) renameText.value = n }
  }
}
function removeApi(id: string) {
  const next = { ...apis.value }
  delete next[id]
  apis.value = next
  if (currentId.value === id) {
    const keys = Object.keys(next)
    if (keys.length) currentId.value = keys[0]
    else {
      const a = createApiRequest()
      apis.value = { [a.id]: a }
      currentId.value = a.id
    }
  }
  void saveApis(apis.value)
}

// ---- 底部状态栏 ----
function fmtTime(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleString() : ''
}

// 方法 -> 工业配色类
function mCls(m?: string): string {
  const key = (m ?? '').toLowerCase()
  const map: Record<string, string> = {
    get: 'httpd-m-get', post: 'httpd-m-post', put: 'httpd-m-put',
    patch: 'httpd-m-patch', delete: 'httpd-m-delete',
    head: 'httpd-m-head', options: 'httpd-m-options',
  }
  return map[key] ?? 'httpd-m-options'
}
const tabs = [
  { key: 'config', label: '配置 Config' },
  { key: 'run', label: '运行 Run·Viz' },
  { key: 'history', label: '历史 History' },
] as const
</script>

<template>
  <div class="httpd flex h-full flex-col bg-background">
    <!-- 工业头部 -->
    <header class="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      <span class="httpd-eyebrow flex items-center gap-2 text-muted-foreground">
        <span class="inline-block h-2 w-2 rounded-full bg-primary" />
        http · debugger
      </span>
      <span v-if="currentApi" class="httpd-chip ml-1" :class="mCls(currentApi.method)">{{ currentApi.method }}</span>
      <span class="min-w-0 truncate font-medium text-foreground">{{ currentApi?.name ?? '—' }}</span>
      <span v-if="currentApi" class="truncate font-mono text-xs text-muted-foreground">{{ currentApi.urlTemplate }}</span>
    </header>

    <div class="flex min-h-0 flex-1">
      <aside v-if="!collapsed" class="w-60 shrink-0 overflow-y-auto border-r border-border bg-card">
        <div class="flex items-center justify-between border-b border-border px-2 py-2">
          <span class="flex items-center gap-1.5 px-1">
            <button class="text-xs text-muted-foreground hover:text-accent-foreground" title="把接口列表收起到最左侧，为主区域腾出空间" @click="collapsed = true">‹</button>
            <span class="httpd-eyebrow text-muted-foreground">接口列表</span>
          </span>
          <button class="httpd-btn rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="新建一个空接口" @click="createApi">+ 新建</button>
        </div>
        <ul class="space-y-0.5 p-1.5">
          <li v-for="a in Object.values(apis)" :key="a.id" class="group flex items-center gap-1">
            <input v-if="renamingId === a.id"
              v-model="renameText"
              class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autofocus @keydown.enter="commitRename" @blur="commitRename" @focus="($event.target as HTMLInputElement).select()" />
            <template v-else>
              <button class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                :class="a.id === currentId ? 'bg-accent text-accent-foreground' : ''"
                :style="a.id === currentId ? { boxShadow: 'inset 2px 0 0 hsl(var(--primary))' } : {}"
                @click="select(a.id)" @dblclick="startRename(a.id)" :title="a.name">
                <span class="w-12 shrink-0 font-mono font-semibold" :class="mCls(a.method)">{{ a.method }}</span>
                <span class="min-w-0 truncate">{{ a.name }}</span>
              </button>
              <button class="shrink-0 text-muted-foreground opacity-0 hover:text-accent-foreground group-hover:opacity-100" title="重命名" @click="startRename(a.id)">✎</button>
              <button class="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" title="删除" @click="removeApi(a.id)">✕</button>
            </template>
          </li>
        </ul>
      </aside>
      <button v-else class="flex w-9 shrink-0 flex-col items-center justify-center gap-1 border-r border-border bg-card text-muted-foreground hover:text-accent-foreground" title="展开接口列表" @click="collapsed = false">
        <span class="font-mono text-lg leading-none">›</span>
        <span class="httpd-eyebrow" style="writing-mode: vertical-rl">接口列表</span>
      </button>

      <main class="min-w-0 flex-1 overflow-auto p-4">
        <div class="mb-4 flex items-center gap-1 border-b border-border">
          <button v-for="t in tabs" :key="t.key" class="px-3 py-2 text-xs font-medium tracking-wide"
            :class="activeTab === t.key ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-accent-foreground'"
            @click="activeTab = t.key">{{ t.label }}</button>
          <button class="ml-auto rounded px-3 py-2 text-xs font-medium tracking-wide hover:bg-accent hover:text-accent-foreground"
            :title="'全局变量与接口导入：可设置默认的环境变量，或从 OpenAPI / curl 导入接口'"
            :class="showEnv ? 'text-primary' : 'text-muted-foreground'" @click="showEnv = !showEnv">环境变量 / 导入</button>
        </div>
        <EnvPanel v-if="showEnv && currentApi" :globals="globals" :api="currentApi" @globals="setGlobals" @import="onImport" />
        <template v-else-if="currentApi">
          <ConfigPanel v-if="activeTab === 'config'" :api="currentApi" @update="save" />
          <RunPanel v-else-if="activeTab === 'run'" :api="currentApi" :globals="globals" @update="save" />
          <HistoryPanel v-else :api-id="currentId" />
        </template>
      </main>
    </div>

    <footer class="flex items-center gap-3 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
      <span v-if="currentApi" class="httpd-chip" :class="mCls(currentApi.method)">{{ currentApi.method }}</span>
      <span class="min-w-0 truncate font-medium text-foreground">{{ currentApi?.name ?? '—' }}</span>
      <span class="min-w-0 truncate font-mono">{{ currentApi?.urlTemplate || '—' }}</span>
      <span class="ml-auto shrink-0" title="该接口最后一次保存的时间">更新于：{{ fmtTime(currentApi?.updatedAt) || '—' }}</span>
    </footer>
  </div>
</template>