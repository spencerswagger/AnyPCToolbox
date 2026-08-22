<script setup lang="ts">
import { createRule, RULE_TYPES, TIMESTAMP_FORMATS, type Rule, type RuleType } from '@/lib/rename/rules'

defineProps<{ rule: Rule; canUp: boolean; canDown: boolean }>()
const emit = defineEmits<{
  (e: 'update:rule', rule: Rule): void
  (e: 'remove'): void
  (e: 'move', dir: -1 | 1): void
}>()

function setType(t: RuleType) {
  emit('update:rule', createRule(t))
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-2 py-1.5 text-xs">
    <!-- 类型 -->
    <select
      class="rounded-md border border-input bg-background px-1.5 py-1 text-xs"
      :value="rule.type"
      @change="setType(RULE_TYPES.find(t => t.value === ($event.target as HTMLSelectElement).value)?.value ?? rule.type)"
    >
      <option v-for="t in RULE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
    </select>

    <!-- 查找-替换 -->
    <template v-if="rule.type === 'replace'">
      <label class="flex items-center gap-1">查找 <input v-model="rule.find" class="w-20 rounded-md border border-input bg-background px-1.5 py-1" placeholder="IMG_"></label>
      <span class="text-muted-foreground">→</span>
      <label class="flex items-center gap-1">替换为 <input v-model="rule.with" class="w-20 rounded-md border border-input bg-background px-1.5 py-1" placeholder="空=删"></label>
      <label class="flex items-center gap-1"><input v-model="rule.onlyFirst" type="checkbox"> 仅首个</label>
      <label class="flex items-center gap-1"><input v-model="rule.regex" type="checkbox"> 正则</label>
    </template>

    <!-- 前缀/后缀 -->
    <template v-if="rule.type === 'prefix' || rule.type === 'suffix'">
      <label class="flex items-center gap-1">{{ rule.type === 'prefix' ? '前缀' : '后缀' }} <input v-model="rule.text" class="w-28 rounded-md border border-input bg-background px-1.5 py-1" placeholder="例如 2025-"></label>
    </template>

    <!-- 序号 -->
    <template v-if="rule.type === 'sequence'">
      <label class="flex items-center gap-1">起始 <input v-model.number="rule.start" type="number" class="w-14 rounded-md border border-input bg-background px-1.5 py-1"></label>
      <label class="flex items-center gap-1">步长 <input v-model.number="rule.step" type="number" class="w-14 rounded-md border border-input bg-background px-1.5 py-1"></label>
      <label class="flex items-center gap-1">位数 <input v-model.number="rule.width" type="number" min="1" class="w-12 rounded-md border border-input bg-background px-1.5 py-1"></label>
      <label class="flex items-center gap-0.5"><input v-model="rule.position" type="radio" value="front"> 前</label>
      <label class="flex items-center gap-0.5"><input v-model="rule.position" type="radio" value="back"> 后</label>
      <label class="flex items-center gap-1">隔 <input v-model="rule.sep" class="w-10 rounded-md border border-input bg-background px-1.5 py-1"></label>
    </template>

    <!-- 时间戳 -->
    <template v-if="rule.type === 'timestamp'">
      <select v-model="rule.format" class="rounded-md border border-input bg-background px-1.5 py-1 text-xs">
        <option v-for="f in TIMESTAMP_FORMATS" :key="f" :value="f">{{ f }}</option>
      </select>
      <label class="flex items-center gap-0.5"><input v-model="rule.source" type="radio" value="mtime"> 文件时间</label>
      <label class="flex items-center gap-0.5"><input v-model="rule.source" type="radio" value="now"> 当前</label>
      <label class="flex items-center gap-0.5"><input v-model="rule.position" type="radio" value="front"> 前</label>
      <label class="flex items-center gap-0.5"><input v-model="rule.position" type="radio" value="back"> 后</label>
      <label class="flex items-center gap-1">隔 <input v-model="rule.sep" class="w-10 rounded-md border border-input bg-background px-1.5 py-1"></label>
    </template>

    <!-- 大小写 -->
    <template v-if="rule.type === 'case'">
      <select v-model="rule.mode" class="rounded-md border border-input bg-background px-1.5 py-1 text-xs">
        <option value="upper">全大写</option>
        <option value="lower">全小写</option>
        <option value="cap">首字母大写</option>
      </select>
    </template>

    <!-- 删除字符 -->
    <template v-if="rule.type === 'remove'">
      <label class="flex items-center gap-0.5"><input v-model="rule.mode" type="radio" value="range"> 删固定位</label>
      <label class="flex items-center gap-0.5"><input v-model="rule.mode" type="radio" value="chars"> 删字符</label>
      <template v-if="rule.mode === 'range'">
        <label class="flex items-center gap-1">第 <input v-model.number="rule.start" type="number" min="1" class="w-12 rounded-md border border-input bg-background px-1.5 py-1"> 位起删</label>
        <label class="flex items-center gap-1"><input v-model.number="rule.count" type="number" min="1" class="w-12 rounded-md border border-input bg-background px-1.5 py-1"> 位</label>
      </template>
      <label v-else class="flex items-center gap-1">删 <input v-model="rule.chars" class="w-20 rounded-md border border-input bg-background px-1.5 py-1" placeholder="如 abc#"></label>
    </template>

    <!-- 扩展名 -->
    <template v-if="rule.type === 'extension'">
      <label class="flex items-center gap-0.5"><input v-model="rule.mode" type="radio" value="keep"> 保留</label>
      <label class="flex items-center gap-0.5"><input v-model="rule.mode" type="radio" value="replace"> 替换为</label>
      <input v-if="rule.mode === 'replace'" v-model="rule.ext" class="w-16 rounded-md border border-input bg-background px-1.5 py-1" placeholder="jpg">
    </template>

    <!-- 操作 -->
    <div class="ml-auto flex items-center gap-1">
      <button type="button" aria-label="上移" class="rounded border border-input px-1.5 text-xs disabled:opacity-40" :disabled="!canUp" @click="emit('move', -1)">↑</button>
      <button type="button" aria-label="下移" class="rounded border border-input px-1.5 text-xs disabled:opacity-40" :disabled="!canDown" @click="emit('move', 1)">↓</button>
      <button type="button" aria-label="删除规则" class="rounded border border-input px-1.5 text-xs hover:bg-destructive/10 hover:text-destructive" @click="emit('remove')">✕</button>
    </div>
  </div>
</template>