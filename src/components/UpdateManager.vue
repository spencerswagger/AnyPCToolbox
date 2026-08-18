<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUpdate } from '@/composables/useUpdate'
import { Download, Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  updateStatus,
  currentVersion,
  latestVersion,
  downloadProgress,
  errorMessage,
  hasUpdate,
  checkForUpdate,
  applyUpdate,
} = useUpdate()

const isTauri = ref(false)
const isMobile = ref(false)
const tauriUpdateAvailable = ref(false)
const tauriUpdateVersion = ref('')
const isDownloading = ref(false)
const downloadProgressVal = ref(0)
const updateError = ref('')

onMounted(async () => {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    isTauri.value = true
    await checkTauriUpdate()
  } else if (typeof window !== 'undefined' && '__TAURI_MOBILE__' in window) {
    isMobile.value = true
  }
})

async function checkTauriUpdate() {
  try {
    const { checkUpdate: tauriCheckUpdate } = await import('@tauri-apps/plugin-updater')
    const update = await tauriCheckUpdate()
    if (update) {
      tauriUpdateAvailable.value = true
      tauriUpdateVersion.value = update.version
    }
  } catch {
    isTauri.value = false
  }
}

async function downloadAndInstall() {
  try {
    const { checkUpdate: tauriCheckUpdate } = await import('@tauri-apps/plugin-updater')
    const update = await tauriCheckUpdate()
    if (!update) return

    isDownloading.value = true
    downloadProgressVal.value = 0

    await update.downloadAndInstall((progress: { chunkLength: number }) => {
      downloadProgressVal.value = progress.chunkLength
    })

    await update.close()
    updateError.value = ''
  } catch (err: unknown) {
    updateError.value = err instanceof Error ? err.message : '下载安装失败'
  } finally {
    isDownloading.value = false
  }
}

const effectiveProgress = computed(() => {
  if (isTauri.value) return downloadProgressVal.value
  return downloadProgress.value
})

function dismiss() {
  emit('close')
}

function handleApplyUpdate() {
  if (isTauri.value && tauriUpdateAvailable.value) {
    downloadAndInstall()
  } else {
    applyUpdate()
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-md animate-in fade-in zoom-in duration-200">
      <div class="rounded-xl border bg-card p-6 shadow-2xl">
        <!-- Header -->
        <div class="mb-6 flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full"
              :class="{
                'bg-primary/10 text-primary': isTauri || hasUpdate,
                'bg-muted text-muted-foreground': !isTauri && !hasUpdate,
              }"
            >
              <Download v-if="isTauri || hasUpdate" class="h-5 w-5" />
              <Check v-else class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold">
                <template v-if="isTauri && tauriUpdateAvailable">桌面端更新可用</template>
                <template v-else-if="hasUpdate">有新版本可用</template>
                <template v-else-if="updateStatus === 'checking'">正在检查更新...</template>
                <template v-else-if="updateStatus === 'downloading'">正在下载...</template>
                <template v-else-if="updateStatus === 'ready'">更新已就绪</template>
                <template v-else-if="updateStatus === 'error'">检查更新失败</template>
                <template v-else>已是最新版本</template>
              </h2>
              <p class="text-sm text-muted-foreground">
                <template v-if="updateStatus === 'checking'">请稍候，正在获取最新版本信息</template>
                <template v-else-if="isTauri && tauriUpdateAvailable">
                  新版本 v{{ tauriUpdateVersion }} 已发布
                </template>
                <template v-else-if="hasUpdate">
                  v{{ currentVersion }} → v{{ latestVersion }}
                </template>
                <template v-else-if="errorMessage || updateError">
                  {{ errorMessage || updateError }}
                </template>
                <template v-else>当前版本 v{{ currentVersion }}</template>
              </p>
            </div>
          </div>
          <button
            class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="dismiss"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Progress Bar -->
        <div v-if="isDownloading || effectiveProgress > 0" class="mb-4">
          <div class="mb-2 flex justify-between text-sm">
            <span class="text-muted-foreground">
              {{ isDownloading ? '下载中...' : '准备更新...' }}
            </span>
            <span class="font-medium">{{ Math.round(effectiveProgress) }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary transition-all duration-300"
              :style="{ width: `${effectiveProgress}%` }"
            />
          </div>
        </div>

        <!-- Mobile Store Info -->
        <div v-if="isMobile" class="mb-4 rounded-lg border bg-muted/50 p-4">
          <div class="flex items-start gap-3">
            <AlertCircle class="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div class="text-sm text-muted-foreground">
              <p class="mb-1 font-medium text-foreground">移动端更新</p>
              <p>
                移动端应用需通过应用商店更新。请前往
                <a
                  class="ml-1 font-medium text-primary hover:underline"
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener"
                >
                  App Store
                </a>
                或
                <a
                  class="ml-1 font-medium text-primary hover:underline"
                  href="https://play.google.com"
                  target="_blank"
                  rel="noopener"
                >
                  Google Play
                </a>
                检查新版本。
              </p>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="(errorMessage || updateError) && !isDownloading" class="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div class="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle class="h-4 w-4" />
            <span>{{ errorMessage || updateError }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            v-if="hasUpdate || (isTauri && tauriUpdateAvailable)"
            class="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            :disabled="isDownloading"
            @click="handleApplyUpdate"
          >
            <Loader2 v-if="isDownloading" class="h-4 w-4 animate-spin" />
            <Download v-else class="h-4 w-4" />
            <span>{{ isDownloading ? '下载中...' : (isTauri ? '下载并安装' : '刷新页面更新') }}</span>
          </button>
          <button
            v-else-if="updateStatus === 'idle' && !hasUpdate"
            class="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="checkForUpdate()"
          >
            <RefreshCw class="h-4 w-4" />
            <span>重新检查</span>
          </button>
          <button
            v-else
            class="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="dismiss"
          >
            <span>关闭</span>
          </button>
        </div>
      </div>

      <!-- Footer Version Info -->
      <p class="mt-3 text-center text-xs text-muted-foreground">
        AnyPCToolbox v{{ currentVersion }}
      </p>
    </div>
  </div>
</template>
