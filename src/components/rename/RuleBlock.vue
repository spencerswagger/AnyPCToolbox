<script setup lang="ts">
import { computed } from 'vue'
import { createRule, RULE_TYPES, RULE_LABEL, TIMESTAMP_FORMATS, type Rule, type RuleType } from '@/lib/rename/rules'

const props = defineProps<{ rule: Rule; canUp: boolean; canDown: boolean }>()
const emit = defineEmits<{
  (e: 'update:rule', rule: Rule): void
  (e: 'remove'): void
  (e: 'move', dir: -1 | 1): void
}>()

const label = computed(() => RULE_LABEL[props.rule.type])

function setType(t: RuleType) {
  emit('update:rule', createRule(t))
}
</script>

<template>
  <div class="space-y-3 rounded-lg border p-3">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium">{{ label }}</span>
      <select class="rounded-md border border-input bg-background px-2 py-1 text-xs" :value="rule.type" @change="setType(($event.target as HTMLSelectElement).value as RuleType)">
        <option v-for="t in RULE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <div class="ml-auto flex items-center gap-1">
        <button type="button" aria-label="上移" class="rounded border border-input px-1.5 text-xs disabled:opacity-40" :disabled="!canUp" @click="emit('move', -1)">↑</button>
        <button type="button" aria-label="下移" class="rounded border border-input px-1.5 text-xs disabled:opacity-40" :disabled="!canDown" @click="emit('move', 1)">↓</button>
        <button type="button" aria-label="删除规则" class="rounded border border-input px-1.5 text-xs hover:bg-destructive/10 hover:text-destructive" @click="emit('remove')">✕</button>
      </div>
    </div>

    <!-- 查找-替换 -->
    <div v-if="rule.type === 'replace'" class="grid gap-2 text-xs">
      <label class="flex items-center gap-2">
        查找
        <input v-model="rule.find" class="flex-1 rounded-md border border-input bg-background px-2 py-1" placeholder="IMG_">
      </label>
      <label class="flex items-center gap-2">
        替换为
        <input v-model="rule.with" class="flex-1 rounded-md border border-input bg-background px-2 py-1" placeholder="保留为空则删除">
      </label>
      <label class="flex items-center gap-2"><input v-model="rule.onlyFirst" type="checkbox"> 仅替换首个</label>
      <details class="text-xs"><summary>高级：正则</summary>
        <label class="flex items-center gap-2 mt-1"><input v-model="rule.regex" type="checkbox"> 当作正则表达式</label>
      </details>
    </div>

    <!-- 前缀/后缀 -->
    <div v-if="rule.type === 'prefix' || rule.type === 'suffix'" class="flex items-center gap-2 text-xs">
      {{ rule.type === 'prefix' ? '前缀文本' : '后缀文本' }}
      <input v-model="rule.text" class="flex-1 rounded-md border border-input bg-background px-2 py-1" placeholder="例如 2025-">
    </div>

    <!-- 序号 -->
    <div v-if="rule.type === 'sequence'" class="grid grid-cols-2 gap-2 text-xs">
      <label>起始 <input v-model.number="rule.start" type="number" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label>步长 <input v-model.number="rule.step" type="number" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label>位数 <input v-model.number="rule.width" type="number" min="1" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label>分隔符 <input v-model="rule.sep" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label class="col-span-2 flex items-center gap-2">位置
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="front"> 前</label>
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="back"> 后</label>
      </label>
    </div>

    <!-- 时间戳 -->
    <div v-if="rule.type === 'timestamp'" class="grid gap-2 text-xs">
      <label>格式
        <select v-model="rule.format" class="w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
          <option v-for="f in TIMESTAMP_FORMATS" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2">来源
        <label class="flex items-center gap-1"><input v-model="rule.source" type="radio" value="mtime"> 文件修改时间</label>
        <label class="flex items-center gap-1"><input v-model="rule.source" type="radio" value="now"> 当前时间</label>
      </label>
      <label class="flex items-center gap-2">位置
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="front"> 前</label>
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="back"> 后</label>
      </label>
      <label>分隔符 <input v-model="rule.sep" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
    </div>

    <!-- 大小写 -->
    <div v-if="rule.type === 'case'" class="flex items-center gap-2 text-xs">
      <select v-model="rule.mode" class="rounded-md border border-input bg-background px-2 py-1 text-xs">
        <option value="upper">全大写</option>
        <option value="lower">全小写</option>
        <option value="cap">首字母大写</option>
      </select>
    </div>

    <!-- 删除字符 -->
    <div v-if="rule.type === 'remove'" class="grid gap-2 text-xs">
      <label class="flex items-center gap-2">方式
        <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="range"> 删固定位</label>
        <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="chars"> 删字符集</label>
      </label>
      <template v-if="rule.mode === 'range'">
        <label>从第几位删(1起) <input v-model.number="rule.start" type="number" min="1" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
        <label>删几位 <input v-model.number="rule.count" type="number" min="1" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      </template>
      <label v-else>删除的字符(可多选) <input v-model="rule.chars" class="w-full rounded-md border border-input bg-background px-2 py-1" placeholder="例如 abc#"></label>
      <details class="text-xs"><summary>说明</summary><span>删除字符集暂不支持正则，请直接输入字符。</span></details>
    </div>

    <!-- 扩展名 -->
    <div v-if="rule.type === 'extension'" class="flex items-center gap-2 text-xs">
      <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="keep"> 保留</label>
      <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="replace"> 替换为</label>
      <input v-if="rule.mode === 'replace'" v-model="rule.ext" class="w-28 rounded-md border border-input bg-background px-2 py-1" placeholder="jpg">
    </div>
  </div>
</template>