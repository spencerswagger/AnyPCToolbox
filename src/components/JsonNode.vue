<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  data: unknown
  keyName?: string
  isLast?: boolean
  depth?: number
}>()

const expanded = ref(props.depth !== undefined ? props.depth < 2 : true)

const toggle = () => {
  expanded.value = !expanded.value
}

const isExpandable = computed(() => {
  if (props.data === null || props.data === undefined) return false
  return typeof props.data === 'object'
})

const isArray = computed(() => Array.isArray(props.data))

const isObject = computed(() => {
  return props.data !== null && !Array.isArray(props.data) && typeof props.data === 'object'
})

const entries = computed(() => {
  if (isArray.value) {
    return (props.data as unknown[]).map((item, i) => ({ key: String(i), value: item }))
  }
  if (isObject.value) {
    const obj = props.data as Record<string, unknown>
    return Object.keys(obj).map((key) => ({ key, value: obj[key] }))
  }
  return []
})

const displayKey = computed(() => {
  if (props.keyName === undefined) return ''
  if (isArray.value) return `[${props.keyName}]`
  return `"${props.keyName}"`
})

const collapsedLabel = computed(() => {
  if (isArray.value) {
    return expanded.value ? '' : `Array(${(props.data as unknown[]).length})`
  }
  if (isObject.value) {
    const keys = Object.keys(props.data as Record<string, unknown>)
    return expanded.value ? '' : `{${keys.length} keys}`
  }
  return ''
})

const primitiveDisplay = computed(() => {
  if (props.data === null) return '<span class="json-null">null</span>'
  if (typeof props.data === 'string') {
    const escaped = escapeHtml(props.data)
    return `<span class="json-string">"${escaped}"</span>`
  }
  if (typeof props.data === 'number') {
    return `<span class="json-number">${props.data}</span>`
  }
  if (typeof props.data === 'boolean') {
    return `<span class="json-boolean">${String(props.data)}</span>`
  }
  return String(props.data)
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
</script>

<template>
  <div class="json-node font-mono text-sm">
    <div class="json-node-row flex items-start">
      <span
        v-if="isExpandable"
        class="json-toggle inline-flex w-4 shrink-0 cursor-pointer select-none items-center justify-center text-muted-foreground transition-transform hover:text-foreground"
        :class="{ 'rotate-90': expanded }"
        @click="toggle"
      >
        ▶
      </span>
      <span v-else class="inline-block w-4 shrink-0" />

      <template v-if="displayKey">
        <span class="json-key shrink-0 text-blue-600 dark:text-blue-400">{{ displayKey }}</span>
        <span class="json-colon shrink-0 text-slate-500">: </span>
      </template>

      <template v-if="isExpandable">
        <span class="json-bracket shrink-0 text-slate-500" @click="toggle" style="cursor:pointer">
          <span v-if="isArray">[</span>
          <span v-else>{</span>
        </span>
        <span v-if="collapsedLabel && !expanded" class="json-collapsed text-muted-foreground">
          {{ collapsedLabel }}
        </span>
        <span v-if="!expanded" class="json-bracket shrink-0 text-slate-500" @click="toggle" style="cursor:pointer">
          <span v-if="isArray">]</span>
          <span v-else>}</span>
        </span>
        <span v-if="!expanded" class="json-ellipsis text-muted-foreground"> ... </span>
      </template>

      <template v-else>
        <span v-html="primitiveDisplay"></span>
      </template>
    </div>

    <div v-if="isExpandable && expanded" class="json-children ml-4 border-l border-border pl-3">
      <JsonNode
        v-for="(entry, idx) in entries"
        :key="entry.key"
        :data="entry.value"
        :key-name="entry.key"
        :is-last="idx === entries.length - 1"
        :depth="(depth || 0) + 1"
      />
    </div>

    <div v-if="isExpandable && expanded" class="json-node-row ml-4">
      <span class="json-bracket text-slate-500">
        <span v-if="isArray">]</span>
        <span v-else>}</span>
      </span>
      <span v-if="!isLast" class="json-comma text-slate-500">,</span>
    </div>
  </div>
</template>
