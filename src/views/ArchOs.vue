<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const frame = ref<HTMLIFrameElement | null>(null)
let timer: number | undefined
const MIN_HEIGHT = 640

/** 读取 iframe 内部内容高度并同步到外层，使页面完整展示（同源可访问 contentDocument） */
function syncHeight(): void {
  const el = frame.value
  if (!el) return
  const doc = el.contentDocument
  if (!doc || !doc.body) return
  const h = Math.max(MIN_HEIGHT, Math.ceil(doc.body.scrollHeight))
  if (el.offsetHeight !== h) {
    el.style.height = `${h}px`
  }
}

onMounted(() => {
  timer = window.setInterval(syncHeight, 300)
})

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearInterval(timer)
})
</script>

<template>
  <div class="space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">操作系统与芯片架构</h2>
      <div class="ml-auto flex items-center gap-2">
        <a
          href="/tools/os-arch-detector.html"
          download="os-arch-detector.html"
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          下载离线版
        </a>
      </div>
    </div>

    <!-- 直接嵌入离线检测页，高度随内容自适应 -->
    <div class="overflow-hidden rounded-lg border bg-card">
      <iframe
        ref="frame"
        src="/tools/os-arch-detector.html"
        title="操作系统与芯片架构检测"
        class="block w-full border-0"
        :style="{ minHeight: MIN_HEIGHT + 'px' }"
        @load="syncHeight"
      />
    </div>
  </div>
</template>