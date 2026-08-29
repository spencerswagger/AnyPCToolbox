<script setup lang="ts">
import { createApiRequest } from '@/lib/debugger/model'
import type { ApiRequest } from '@/lib/debugger/model'
import { getApis, saveApis } from '@/lib/debugger/db'
import ConfigPanel from '@/components/debugger/ConfigPanel.vue'
import RunPanel from '@/components/debugger/RunPanel.vue'
import { onMounted, ref } from 'vue'

const apis = ref<Record<string, ApiRequest>>({})
const currentId = ref<string>('')
const activeTab = ref<'config' | 'run' | 'history'>('config')

onMounted(async () => {
  apis.value = await getApis()
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
      <div class="mb-4 flex gap-1 border-b border-border">
        <button v-for="t in (['config','run','history'] as const)" :key="t" class="px-3 py-2 text-sm"
          :class="activeTab === t ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'"
          @click="activeTab = t">{{ { config: '配置', run: '运行·可视化', history: '历史' }[t] }}</button>
      </div>
      <template v-if="apis[currentId]">
        <ConfigPanel v-if="activeTab === 'config'" :api="apis[currentId]" @update="save" />
        <RunPanel v-else-if="activeTab === 'run'" :api="apis[currentId]" @update="save" />
        <p v-else class="text-sm text-muted-foreground">该 Tab 在后续任务实现。</p>
      </template>
    </main>
  </div>
</template>