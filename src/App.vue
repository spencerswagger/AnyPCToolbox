<script setup lang="ts">
import Toaster from '@/components/ui/Toaster.vue'
import AppLayout from '@/components/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
  <Toaster />
</template>