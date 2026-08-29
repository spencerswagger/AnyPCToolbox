<script setup lang="ts">
import JsonNode from './JsonNode.vue'

const props = defineProps<{
  value: unknown
  rootLabel?: string
  pickable?: boolean
  maxHeightClass?: string
}>()
const emit = defineEmits<{ (e: 'pick', path: string): void }>()
</script>

<template>
  <div class="httpd-console overflow-auto" :class="props.maxHeightClass ?? 'max-h-[60vh]'">
    <ul class="p-2">
      <JsonNode
        :value="value"
        :label="rootLabel"
        :path="rootLabel ? rootLabel : ''"
        :pickable="!!pickable"
        @pick="(p) => emit('pick', p)"
      />
    </ul>
  </div>
</template>