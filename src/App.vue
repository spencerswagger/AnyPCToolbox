<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useUpdate } from '@/composables/useUpdate'

const { startUpdatePolling, stopUpdatePolling } = useUpdate()

onMounted(startUpdatePolling)
onUnmounted(stopUpdatePolling)
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
</template>
