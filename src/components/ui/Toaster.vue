<script setup lang="ts">
import {
  ToastProvider,
  ToastViewport,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import { toasts, dismiss } from '@/lib/ui/use-toast'
</script>

<template>
  <ToastProvider :duration="0">
    <template v-for="t in toasts" :key="t.id">
      <ToastRoot
        v-model:open="t.open"
        @update:open="(open: boolean) => { if (!open) dismiss(t.id) }"
        class="pointer-events-auto relative flex w-[380px] items-center justify-between gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
      >
        <div class="grid min-w-0 gap-1">
          <ToastTitle v-if="t.title" class="truncate text-sm font-medium">{{ t.title }}</ToastTitle>
          <ToastDescription v-if="t.description" class="truncate text-sm text-muted-foreground">
            {{ t.description }}
          </ToastDescription>
        </div>
        <ToastClose
          class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X class="h-4 w-4" />
        </ToastClose>
      </ToastRoot>
    </template>
    <ToastViewport
      class="pointer-events-none fixed left-1/2 top-4 z-[120] flex w-full -translate-x-1/2 flex-col items-center gap-2 p-4"
    />
  </ToastProvider>
</template>