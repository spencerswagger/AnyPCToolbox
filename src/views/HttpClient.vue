<script setup lang="ts">
import { createApiRequest } from '@/lib/debugger/model'
import type { ApiRequest } from '@/lib/debugger/model'
import { getApis, saveApis } from '@/lib/debugger/db'
import { onMounted, ref } from 'vue'

const apis = ref<Record<string, ApiRequest>>({})
const currentId = ref<string>('')

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
</script>

<template>
  <div class="flex h-full">
    <aside class="w-60 shrink-0 border-r border-border bg-card p-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">接口列表</span>
      </div>
      <p class="text-sm text-muted-foreground">正在搭建…</p>
    </aside>
    <main class="flex-1 overflow-auto">{{ currentId }}</main>
  </div>
</template>