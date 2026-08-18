<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUpdate } from '@/composables/useUpdate'
import { Download, X } from 'lucide-vue-next'

const { currentVersion, latestVersion, hasUpdate, applyUpdate } = useUpdate()

const showBanner = ref(false)
const dismissed = ref(false)

const isTauri = computed(() => '__TAURI__' in window)

onMounted(async () => {
  const { onUpdateAvailable } = await import('@/composables/useUpdate')
  onUpdateAvailable(() => {
    if (!dismissed.value) {
      showBanner.value = true
    }
  })
})

function handleRefresh() {
  if (isTauri.value) {
    window.location.reload()
  } else {
    applyUpdate()
  }
}

function handleDismiss() {
  showBanner.value = false
  dismissed.value = true
  setTimeout(() => {
    dismissed.value = false
  }, 30 * 60 * 1000)
}
</script>

<template>
  <Transition name="banner-slide">
    <div
      v-if="hasUpdate && showBanner"
      class="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-3 duration-300"
    >
      <div class="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download class="h-4 w-4" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">
            新版本 v{{ latestVersion }} 可用
          </p>
          <p class="truncate text-xs text-muted-foreground">
            当前版本 v{{ currentVersion }} → v{{ latestVersion }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            @click="handleRefresh"
          >
            立即刷新
          </button>
          <button
            class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="handleDismiss"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: all 0.3s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
