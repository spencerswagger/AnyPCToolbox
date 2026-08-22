<script setup lang="ts">
import ToolCard from '@/components/ToolCard.vue'

const tools = [
  {
    icon: '📝',
    name: 'Markdown 编辑器',
    description: '编辑与实时预览 Markdown 文档，支持语法高亮与导出',
    route: '/markdown',
    tag: 'v1.0',
  },
  {
    icon: '🧾',
    name: 'JSON 编辑器',
    description: '格式化、校验与预览 JSON 数据，错误定位一目了然',
    route: '/json',
    tag: 'v1.0',
  },
  {
    icon: '🪪',
    name: '身份证号工具',
    description: '校验位校验、发证地与生日性别年龄解析、批量生成与复制',
    route: '/idcard',
    tag: 'v1.0',
  },
  {
    icon: '🖥️',
    name: '操作系统与芯片架构',
    description: '自动识别系统与芯片架构，附带各平台的图文自查指引',
    route: '/arch-os',
    tag: 'v1.0',
  },
  {
    icon: '🔤',
    name: '文本处理中台',
    description: '一次输入全部产出：编解码、哈希、统计、时间戳识别、智能解码',
    route: '/text-hub',
    tag: 'v1.1',
  },
  {
    icon: '📁',
    name: '文件批量重命名',
    description: '可视化规则块 + 实时预览，批量重命名文件并在桌面端真正写盘',
    route: '/rename',
    tag: 'v1.0',
  },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">工具集合</h1>
      <p class="mt-1 text-muted-foreground">选择一个工具开始使用</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ToolCard
        v-for="tool in tools"
        :key="tool.route"
        v-bind="tool"
      />
      <div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center opacity-60">
        <span class="mb-3 text-4xl">➕</span>
        <h3 class="text-base font-semibold">更多工具</h3>
        <p class="mt-1 text-sm text-muted-foreground">即将上线</p>
      </div>
    </div>
  </div>
</template>