<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import AppLayout from '@/components/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
  <Toaster position="top-center" :toast-options="{ duration: 2500 }" close-button rich-colors />
</template>