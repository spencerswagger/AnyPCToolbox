<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAccess } from '@/lib/access/useAccess.ts'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const { unlocked, unlock, lock } = useAccess()

const passcode = ref('')
const error = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
let submitting = false

function close() {
  emit('update:open', false)
}

function reset() {
  passcode.value = ''
  error.value = false
}

async function submit() {
  if (!passcode.value || submitting) return
  submitting = true
  const ok = await unlock(passcode.value)
  submitting = false
  if (ok) {
    reset()
    close()
  } else {
    error.value = true
  }
}

function handleLock() {
  lock()
  close()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      reset()
      nextTick(() => inputEl.value?.focus())
    }
  },
)

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
      <h2 class="text-base font-semibold">访问密钥</h2>

      <template v-if="unlocked">
        <p class="mt-2 text-sm text-muted-foreground">已解锁，隐藏工具已显示。</p>
        <button
          class="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          @click="handleLock"
        >
          锁定
        </button>
      </template>

      <template v-else>
        <input
          ref="inputEl"
          v-model="passcode"
          type="password"
          placeholder="输入访问密钥"
          class="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @keyup.enter="submit"
        />
        <p v-if="error" class="mt-2 text-sm text-destructive">密钥无效</p>
        <button
          class="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          @click="submit"
        >
          解锁
        </button>
      </template>
    </div>
  </div>
</template>
