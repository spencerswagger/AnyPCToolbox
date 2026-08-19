<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'
import UpdateBanner from './UpdateBanner.vue'
import UpdateManager from './UpdateManager.vue'

const router = useRouter()
const showBackTop = ref(false)

const SCROLL_THRESHOLD = 300

function handleScroll() {
  showBackTop.value = window.scrollY > SCROLL_THRESHOLD
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
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
    <UpdateBanner />
    <main class="mx-auto w-full max-w-[1800px] px-4 py-6 md:px-6 md:py-8">
      <slot />
    </main>

    <Transition name="fade">
      <button
        v-show="showBackTop"
        class="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background shadow-lg transition-all hover:bg-accent hover:text-accent-foreground"
        title="回到顶部"
        @click="scrollToTop"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5"/>
          <path d="M5 12l7-7 7 7"/>
        </svg>
      </button>
    </Transition>
    <UpdateManager />
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>