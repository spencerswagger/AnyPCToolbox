<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'radix-vue'

withDefaults(defineProps<{
  side?: 'top' | 'bottom' | 'left' | 'right'
  // 传入文字时显示文字本身；否则显示 ? 图标
  text?: string
}>(), { side: 'bottom' })
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <span
        v-if="text"
        class="cursor-help text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
      >{{ text }}</span>
      <span
        v-else
        class="inline-flex h-3.5 w-3.5 cursor-help select-none items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted-foreground hover:bg-accent hover:text-foreground"
      >?</span>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        class="z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md"
      >
        <slot />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>