<script setup lang="ts">
import { computed, ref } from 'vue'
defineOptions({ name: 'JsonNode' })

const props = defineProps<{
  label?: string
  value: unknown
  path: string // 相对根节点的路径（'' 表示根）
  pickable: boolean
}>()
const emit = defineEmits<{ (e: 'pick', path: string): void }>()

const open = ref(true)
const isArr = Array.isArray(props.value)
const isObj = props.value !== null && typeof props.value === 'object'
const isContainer = isArr || isObj

const preview = computed(() => {
  if (isArr) return `array[${props.value.length}]`
  if (isObj) return `object`
  const v = props.value
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
})
const meta = computed(() => {
  const v = props.value
  if (v === null) return 'j-null'
  const t = typeof v
  return t === 'string' ? 'j-str' : t === 'number' ? 'j-num' : t === 'boolean' ? 'j-bool' : 'j-key'
})
// 数组且至少一个元素是对象 → 才提供「设为列表」
const isListArray = computed(() => isArr && props.value.length > 0 && typeof props.value[0] === 'object' && !Array.isArray(props.value[0]))

function childPath(i: number, key?: string): string {
  if (isArr) return `${props.path}[${i}]`
  return props.path ? `${props.path}.${key}` : (key ?? '')
}
function onPick() {
  emit('pick', props.path)
}
</script>

<template>
  <li class="whitespace-pre text-xs leading-6">
    <span class="group flex items-start gap-1">
      <button
        v-if="isContainer"
        class="w-3 shrink-0 select-none text-muted-foreground"
        @click="open = !open"
      >{{ open ? '▾' : '▸' }}</button>
      <span v-else class="w-3 shrink-0" />
      <template v-if="label !== undefined">
        <span class="text-primary">{{ label }}</span><span class="text-muted-foreground">:&nbsp;</span>
      </template>
      <span class="tree-val" :class="'tv-' + meta">{{ preview }}</span>
      <button
        v-if="isListArray && pickable"
        class="ml-1 hidden rounded border border-border px-1 text-[10px] leading-4 text-primary hover:bg-accent group-hover:inline-block"
        :title="'把「' + (label ?? path) + '」设为列表，表格将切到这里，可往下逐级查看'"
        @click.stop="onPick"
      >⇘ 设为列表</button>
    </span>
    <ul v-if="isContainer && open" class="ml-3 border-l border-border pl-2">
      <template v-if="isArr">
        <JsonNode
          v-for="(item, i) in (value as unknown[])"
          :key="i"
          :value="item"
          :label="String(i)"
          :path="childPath(i)"
          :pickable="pickable"
          @pick="(p) => emit('pick', p)"
        />
      </template>
      <template v-else>
        <JsonNode
          v-for="(item, k) in (value as Record<string, unknown>)"
          :key="k"
          :value="item"
          :label="k"
          :path="childPath(0, k)"
          :pickable="pickable"
          @pick="(p) => emit('pick', p)"
        />
      </template>
    </ul>
  </li>
</template>