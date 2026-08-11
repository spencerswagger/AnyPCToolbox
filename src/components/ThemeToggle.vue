<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { Sun, Moon } from 'lucide-vue-next'

const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
           disabled:pointer-events-none disabled:opacity-50
           hover:bg-accent hover:text-accent-foreground
           h-9 w-9"
    @click="toggle"
    :title="isDark ? '切换亮色模式' : '切换暗色模式'"
  >
    <Sun v-if="!isDark" class="h-5 w-5" />
    <Moon v-else class="h-5 w-5" />
  </button>
</template>