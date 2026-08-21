<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
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

    <!-- 直接嵌入离线检测页 -->
    <div class="overflow-hidden rounded-lg border bg-card">
      <iframe
        src="/tools/os-arch-detector.html"
        title="操作系统与芯片架构检测"
        class="block w-full min-h-[680px] border-0"
      />
    </div>
  </div>
</template>