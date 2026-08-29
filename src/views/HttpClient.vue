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
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex min-h-0 flex-1">
      <aside v-if="!collapsed" class="w-60 shrink-0 overflow-y-auto border-r border-border bg-card p-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="flex items-center gap-1">
            <button class="text-muted-foreground hover:text-accent-foreground" title="折叠接口列表" @click="collapsed = true">◂</button>
            <span class="text-xs uppercase tracking-wider text-muted-foreground">接口列表</span>
          </span>
          <button class="text-sm text-primary hover:underline" @click="createApi">+ 新建</button>
        </div>
        <ul class="space-y-1">
          <li v-for="a in Object.values(apis)" :key="a.id" class="group flex items-center gap-1">
            <input v-if="renamingId === a.id"
              v-model="renameText"
              class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autofocus @keydown.enter="commitRename" @blur="commitRename" @focus="($event.target as HTMLInputElement).select()" />
            <template v-else>
              <button class="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                :class="a.id === currentId ? 'bg-accent text-accent-foreground' : ''"
                @click="select(a.id)" @dblclick="startRename(a.id)" :title="a.name">{{ a.name }}</button>
              <button class="shrink-0 text-muted-foreground opacity-0 hover:text-accent-foreground group-hover:opacity-100" title="重命名" @click="startRename(a.id)">✎</button>
              <button class="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" title="删除" @click="removeApi(a.id)">✕</button>
            </template>
          </li>
        </ul>
      </aside>
      <button v-else class="w-9 shrink-0 border-r border-border bg-card text-center text-muted-foreground hover:text-accent-foreground" title="展开接口列表" @click="collapsed = false">▸</button>
      <main class="min-w-0 flex-1 overflow-auto p-4">
        <div class="mb-4 flex items-center gap-1 border-b border-border">
          <button v-for="t in (['config','run','history'] as const)" :key="t" class="px-3 py-2 text-sm"
            :class="activeTab === t ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'"
            @click="activeTab = t">{{ { config: '配置', run: '运行·可视化', history: '历史' }[t] }}</button>
          <button class="ml-auto rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            :class="showEnv ? 'text-accent-foreground' : ''" @click="showEnv = !showEnv">⚙ 环境管理</button>
        </div>
        <EnvPanel v-if="showEnv && currentApi" :globals="globals" :api="currentApi" @globals="setGlobals" @import="onImport" />
        <template v-else-if="currentApi">
          <ConfigPanel v-if="activeTab === 'config'" :api="currentApi" @update="save" />
          <RunPanel v-else-if="activeTab === 'run'" :api="currentApi" :globals="globals" @update="save" />
          <HistoryPanel v-else :api-id="currentId" />
        </template>
      </main>
    </div>
    <footer class="flex items-center gap-3 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <span class="font-medium text-foreground">{{ currentApi?.name ?? '—' }}</span>
      <span>{{ currentApi?.method }} {{ currentApi?.urlTemplate }}</span>
      <span class="ml-auto">更新时间：{{ fmtTime(currentApi?.updatedAt) || '—' }}</span>
    </footer>
  </div>
</template>