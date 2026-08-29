import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/markdown',
      name: 'markdown',
      component: () => import('@/views/Markdown.vue'),
    },
    {
      path: '/json',
      name: 'json',
      component: () => import('@/views/DataFormats.vue'),
    },
    {
      path: '/idcard',
      name: 'idcard',
      component: () => import('@/views/IdCard.vue'),
    },
    {
      path: '/text-hub',
      name: 'text-hub',
      component: () => import('@/views/TextHub.vue'),
    },
    {
      path: '/arch-os',
      name: 'arch-os',
      component: () => import('@/views/ArchOs.vue'),
    },
    {
      path: '/rename',
      name: 'rename',
      component: () => import('@/views/Rename.vue'),
    },
    {
      path: '/units',
      name: 'units',
      component: () => import('@/views/Units.vue'),
    },
    {
      path: '/http-client',
      name: 'http-client',
      component: () => import('@/views/HttpClient.vue'),
    },
  ],
})

export default router