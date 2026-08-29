<script setup lang="ts">
import { ref } from 'vue'
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'radix-vue'
import JsonTree from './JsonTree.vue'
import JsonModal from './JsonModal.vue'

const props = defineProps<{
  value: unknown
  basePath: string // 该字段值在完整响应中的绝对 JSONPath
  title: string
  // 当在「弹框内下钻」语境（如弹框里的列表）时传入：点「查看」直接在弹框内展开该值，而非再弹一层
  drill?: (value: unknown, field: string) => void
}>()
const modalOpen = ref(false)

const arr = Array.isArray(props.value)
const badge = arr ? `array[${props.value.length}]` : 'object'
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <TooltipRoot :delay-duration="120">
      <TooltipTrigger as-child>
        <button
          class="rounded border border-border px-2 py-0.5 text-xs font-medium text-primary hover:bg-accent"
          :title="title"
          @click="props.drill ? props.drill(props.value, props.title) : (modalOpen = true)"
        >查看</button>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="bottom" align="start" :side-offset="4" class="z-50 w-[24rem] max-w-[24rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div class="max-h-[20rem] overflow-auto p-2">
            <div class="mb-1 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
              <span class="httpd-chip httpd-chip-bg">{{ badge }}</span>
              <span class="truncate font-mono">{{ basePath }}</span>
            </div>
            <JsonTree :value="value" :pickable="false" max-height-class="" />
          </div>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
    <span class="font-mono text-[10px] text-muted-foreground">{{ badge }}</span>

    <JsonModal
      v-if="modalOpen"
      :value="value"
      :title="title"
      :base-path="basePath"
      @close="modalOpen = false"
    />
  </span>
</template>