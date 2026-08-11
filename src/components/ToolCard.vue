<script setup lang="ts">
import { useRouter } from 'vue-router'

interface Props {
  icon: string
  name: string
  description: string
  route: string
  tag?: string
}

const props = defineProps<Props>()
const router = useRouter()

function navigate() {
  router.push(props.route)
}
</script>

<template>
  <button
    class="group flex flex-col items-start rounded-xl border bg-card p-6 text-left
           shadow-sm transition-all hover:border-primary hover:shadow-md
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="navigate"
  >
    <span class="mb-3 text-4xl">{{ icon }}</span>
    <h3 class="text-base font-semibold">{{ name }}</h3>
    <p class="mt-1 text-sm text-muted-foreground leading-relaxed">{{ description }}</p>
    <span v-if="tag" class="mt-3 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {{ tag }}
    </span>
  </button>
</template>