<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { areas, provinceOptions, cityOptions, districtOptions } from '@/lib/areaData'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const selProvince = ref('')
const selCity = ref('')
const selDistrict = ref('')
// 展开态：决定下一级显示哪一列
const expandedProvince = ref('')
const expandedCity = ref('')

watch(
  () => props.modelValue,
  (v) => syncFromValue(v),
  { immediate: true },
)

function syncFromValue(v: string): void {
  if (!v) {
    expandedProvince.value = selProvince.value = selCity.value = selDistrict.value = expandedCity.value = ''
    return
  }
  if (/^\d{2}0000$/.test(v)) {
    selProvince.value = v
    selCity.value = selDistrict.value = expandedCity.value = ''
  } else if (/^\d{4}00$/.test(v)) {
    selProvince.value = `${v.slice(0, 2)}0000`
    selCity.value = v
    selDistrict.value = expandedCity.value = ''
  } else {
    selProvince.value = `${v.slice(0, 2)}0000`
    selCity.value = `${v.slice(0, 4)}00`
    selDistrict.value = v
    expandedCity.value = selCity.value
  }
  expandedProvince.value = selProvince.value
}

// 点击组件外部时关闭（面板内部点击不影响展开态，保证省→市→区可连续选择）
function onOutside(e: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onOutside))
onUnmounted(() => document.removeEventListener('mousedown', onOutside))

const provinces = provinceOptions
const cities = computed(() => cityOptions(expandedProvince.value))
/** 是否有市级（直辖市/省直辖县级无市） */
const hasCity = computed(() => cities.value.length > 0)
/** 第二列内容：有市→城市列表；无市（直辖市）→全省区县 */
const secondColumn = computed(() =>
  hasCity.value
    ? cities.value.map((c) => ({ code: c.code, name: c.name, isDistrict: false }))
    : districtOptions(expandedProvince.value).map((d) => ({ code: d.code, name: d.name, isDistrict: true })),
)
/** 第三列：选中市后的区县 */
const thirdColumn = computed(() =>
  hasCity.value && expandedCity.value ? districtOptions(expandedProvince.value, expandedCity.value) : [],
)

const displayText = computed(() => {
  const parts = []
  if (selProvince.value) parts.push(areas[selProvince.value] ?? '')
  if (selCity.value) parts.push(areas[selCity.value] ?? '')
  if (selDistrict.value) parts.push(areas[selDistrict.value] ?? '')
  return parts.join(' / ')
})

function toggle(): void {
  open.value = !open.value
}
function pickProvince(code: string): void {
  expandedProvince.value = code
  selProvince.value = code
  selCity.value = selDistrict.value = expandedCity.value = ''
  emit('update:modelValue', code)
}
function pickCity(code: string): void {
  expandedCity.value = code
  selCity.value = code
  selDistrict.value = ''
  emit('update:modelValue', code)
}
function pickDistrict(code: string): void {
  selDistrict.value = code
  emit('update:modelValue', code)
  open.value = false
}
function clearAll(): void {
  syncFromValue('')
  emit('update:modelValue', '')
  open.value = false
}

function isSelected(code: string): boolean {
  return selProvince.value === code || selCity.value === code || selDistrict.value === code
}
function isExpanded(code: string): boolean {
  return expandedProvince.value === code || expandedCity.value === code
}
</script>

<template>
  <div ref="root" class="relative w-full">
    <button
      type="button"
      class="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
      :class="open ? 'bg-accent/50' : ''"
      @click.stop="toggle"
    >
      <span class="truncate text-left" :class="displayText ? 'text-foreground' : 'text-muted-foreground'">
        {{ displayText || '不限地区' }}
      </span>
      <svg
        class="shrink-0 transition-transform"
        :class="open ? 'rotate-180' : ''"
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
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="absolute left-0 top-full z-50 mt-1 flex overflow-hidden rounded-lg border bg-background shadow-md">
      <ul class="max-h-64 w-36 overflow-y-auto">
        <li
          class="cursor-pointer px-3 py-1.5 text-sm outline-none"
          :class="isSelected(p.code) ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'"
          v-for="p in provinces"
          :key="p.code"
          @click="pickProvince(p.code)"
        >
          {{ p.name }}
        </li>
      </ul>

      <ul v-if="expandedProvince" class="max-h-64 w-36 overflow-y-auto border-l">
        <li
          class="cursor-pointer px-3 py-1.5 text-sm outline-none"
          :class="
            isSelected(c.code) || isExpanded(c.code)
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-accent/50'
          "
          v-for="c in secondColumn"
          :key="c.code"
          @click="c.isDistrict ? pickDistrict(c.code) : pickCity(c.code)"
        >
          {{ c.name }}
        </li>
      </ul>

      <ul v-if="thirdColumn.length" class="max-h-64 w-36 overflow-y-auto border-l">
        <li
          class="cursor-pointer px-3 py-1.5 text-sm outline-none"
          :class="isSelected(d.code) ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'"
          v-for="d in thirdColumn"
          :key="d.code"
          @click="pickDistrict(d.code)"
        >
          {{ d.name }}
        </li>
      </ul>

      <button
        type="button"
        class="cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent/50 hover:text-foreground"
        @click="clearAll"
      >
        不限地区
      </button>
    </div>
  </div>
</template>