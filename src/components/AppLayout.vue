<script setup lang="ts">
import { useRouter } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex h-14 items-center justify-between px-4 md:px-6">
        <button
          class="flex items-center gap-2 font-semibold"
          @click="router.push('/')"
        >
          <span class="inline-flex items-center justify-center rounded-lg bg-primary p-1.5 text-primary-foreground text-sm">🧰</span>
          <span class="hidden sm:inline-block">AnyPCToolbox</span>
        </button>
        <div class="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <slot />
    </main>
  </div>
</template>