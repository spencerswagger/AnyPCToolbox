<script setup lang="ts">
import { computed } from 'vue'
import { useUpdate } from '@/composables/useUpdate'

const {
  status,
  currentVersion,
  latestVersion,
  releaseNotes,
  buildTime,
  errorMessage,
  progress,
  showManager,
  applyUpdate,
  isTauri,
} = useUpdate()

const percent = computed(() => {
  const { downloaded, contentLength } = progress.value
  if (!contentLength) return 0
  return Math.min(100, Math.round((downloaded / contentLength) * 100))
})

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(1)} ${units[i]}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="update-overlay">
      <div
        v-if="showManager"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="应用更新"
      >
        <div class="w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl">
          <h2 class="text-lg font-semibold">发现新版本</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            v{{ currentVersion }}
            <span class="mx-1">→</span>
            <span class="font-medium text-primary">v{{ latestVersion }}</span>
          </p>
          <p v-if="buildTime" class="mt-1 text-xs text-muted-foreground">
            发布于 {{ new Date(buildTime).toLocaleString() }}
          </p>

          <div
            v-if="releaseNotes"
            class="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm"
          >{{ releaseNotes }}</div>

          <div v-if="status === 'downloading'" class="mt-4">
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${percent}%` }"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ percent }}% · {{ formatBytes(progress.downloaded) }} /
              {{ formatBytes(progress.contentLength) }}
            </p>
          </div>

          <p
            v-if="status === 'ready'"
            class="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
          >
            更新已安装，应用即将重启；若未自动重启，请手动重新打开。
          </p>
          <p
            v-if="status === 'error'"
            class="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            更新失败：{{ errorMessage }}
          </p>

          <div class="mt-6 flex justify-end gap-2">
            <button
              v-if="status === 'available' || status === 'error'"
              class="rounded-md border px-4 py-2 text-sm transition-colors hover:bg-accent"
              @click="showManager = false"
            >
              稍后提醒
            </button>
            <button
              v-if="status === 'available' || status === 'error'"
              class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              @click="applyUpdate"
            >
              {{ isTauri ? '下载并安装' : '刷新页面更新' }}
            </button>
            <button
              v-if="status === 'downloading' || status === 'ready'"
              disabled
              class="cursor-not-allowed rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground opacity-50"
            >
              {{ status === 'downloading' ? '更新中…' : '完成' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.update-overlay-enter-active,
.update-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.update-overlay-enter-from,
.update-overlay-leave-to {
  opacity: 0;
}
</style>
