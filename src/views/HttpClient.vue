<script setup lang="ts">
import { createApiRequest } from '@/lib/debugger/model'
import type { ApiRequest } from '@/lib/debugger/model'
import { getApis, saveApis, getGlobals, saveGlobals } from '@/lib/debugger/db'
import ConfigPanel from '@/components/debugger/ConfigPanel.vue'
import RunPanel from '@/components/debugger/RunPanel.vue'
import HistoryPanel from '@/components/debugger/HistoryPanel.vue'
import EnvPanel from '@/components/debugger/EnvPanel.vue'
import { onMounted, ref } from 'vue'

const apis = ref<Record<string, ApiRequest>>({})
const currentId = ref<string>('')
const activeTab = ref<'config' | 'run' | 'history'>('config')
const globals = ref<Record<string, string>>({})
const showEnv = ref(false)

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
</script>

<template>
  <div class="flex h-full">
    <aside class="w-60 shrink-0 border-r border-border bg-card p-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">接口列表</span>
      </div>
      <ul class="space-y-1">
        <li v-for="a in Object.values(apis)" :key="a.id">
          <button class="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            :class="a.id === currentId ? 'bg-accent text-accent-foreground' : ''" @click="select(a.id)">{{ a.name }}</button>
        </li>
      </ul>
    </aside>
    <main class="flex-1 overflow-auto p-4">
      <div class="mb-4 flex items-center gap-1 border-b border-border">
        <button v-for="t in (['config','run','history'] as const)" :key="t" class="px-3 py-2 text-sm"
          :class="activeTab === t ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'"
          @click="activeTab = t">{{ { config: '配置', run: '运行·可视化', history: '历史' }[t] }}</button>
        <button class="ml-auto rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          :class="showEnv ? 'text-accent-foreground' : ''" @click="showEnv = !showEnv">⚙ 环境管理</button>
      </div>
      <EnvPanel v-if="showEnv && apis[currentId]" :globals="globals" :api="apis[currentId]" @globals="setGlobals" @import="onImport" />
      <template v-else-if="apis[currentId]">
        <ConfigPanel v-if="activeTab === 'config'" :api="apis[currentId]" @update="save" />
        <RunPanel v-else-if="activeTab === 'run'" :api="apis[currentId]" :globals="globals" @update="save" />
        <HistoryPanel v-else :api-id="currentId" />
      </template>
    </main>
  </div>
</template>