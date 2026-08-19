<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { areas, provinceOptions, cityOptions, districtOptions } from '@/lib/areaData'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const selProvince = ref('')
const selCity = ref('')
const selDistrict = ref('')
// 展开态：决定当前鼠标/选择停在哪一级，驱动下一列显示
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
}
function clearAll(): void {
  syncFromValue('')
  emit('update:modelValue', '')
}

function isSelected(code: string): boolean {
  return selProvince.value === code || selCity.value === code || selDistrict.value === code
}
function isExpanded(code: string): boolean {
  return expandedProvince.value === code || expandedCity.value === code
}
</script>

<template>
  <div class="w-full">
    <!-- 当前选择路径 + 清除 -->
    <div class="mb-1.5 flex h-5 items-center justify-between gap-2 text-xs text-muted-foreground">
      <span class="truncate" :class="displayText ? 'text-foreground' : ''">{{ displayText || '不限地区' }}</span>
      <button
        type="button"
        class="shrink-0 rounded px-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="clearAll"
      >
        清除
      </button>
    </div>

    <!-- 常驻三列联动面板 -->
    <div class="flex gap-1.5 text-sm">
      <div class="flex-1 overflow-hidden rounded-md border bg-background">
        <div class="h-5 border-b bg-accent/40 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          省份
        </div>
        <ul class="max-h-44 overflow-y-auto py-0.5">
          <li
            class="cursor-pointer truncate px-2 py-1 outline-none"
            :class="isSelected(p.code) ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'"
            v-for="p in provinces"
            :key="p.code"
            @click="pickProvince(p.code)"
          >
            {{ p.name }}
          </li>
        </ul>
      </div>

      <div class="flex-1 overflow-hidden rounded-md border bg-background">
        <div class="h-5 border-b bg-accent/40 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {{ hasCity ? '城市' : '区县' }}
        </div>
        <ul v-if="expandedProvince" class="max-h-44 overflow-y-auto py-0.5">
          <li
            class="cursor-pointer truncate px-2 py-1 outline-none"
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
        <div v-else class="flex h-[calc(100%-1.25rem)] min-h-8 items-center justify-center text-xs text-muted-foreground">
          请先选择省份
        </div>
      </div>

      <div class="flex-1 overflow-hidden rounded-md border bg-background">
        <div class="h-5 border-b bg-accent/40 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          区县
        </div>
        <ul v-if="thirdColumn.length" class="max-h-44 overflow-y-auto py-0.5">
          <li
            class="cursor-pointer truncate px-2 py-1 outline-none"
            :class="isSelected(d.code) ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'"
            v-for="d in thirdColumn"
            :key="d.code"
            @click="pickDistrict(d.code)"
          >
            {{ d.name }}
          </li>
        </ul>
        <div v-else class="flex h-[calc(100%-1.25rem)] min-h-8 items-center justify-center text-xs text-muted-foreground">
          请先选择城市
        </div>
      </div>
    </div>
  </div>
</template>