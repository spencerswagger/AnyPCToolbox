<script setup lang="ts">
import { ref } from 'vue'
import { useUpdate } from '@/composables/useUpdate'

const { status, latestVersion, applyUpdate, showManager, isTauri } = useUpdate()
const dismissed = ref(false)
</script>

<template>
  <Transition name="update-banner">
    <div
      v-if="status === 'available' && !dismissed"
      class="sticky top-14 z-40 flex items-center justify-center gap-3 border-b bg-primary/10 px-4 py-2 text-sm"
    >
      <span class="font-medium text-primary">发现新版本 v{{ latestVersion }}</span>
      <button
        v-if="!isTauri"
        class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        @click="applyUpdate"
      >
        立即更新
      </button>
      <button
        v-else
        class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        @click="showManager = true"
      >
        查看详情
      </button>
      <button
        class="text-muted-foreground transition-colors hover:text-foreground"
        title="本次忽略"
        aria-label="忽略更新提示"
        @click="dismissed = true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style>
.update-banner-enter-active,
.update-banner-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.update-banner-enter-from,
.update-banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
