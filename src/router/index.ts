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
      component: () => import('@/views/Json.vue'),
    },
    {
      path: '/idcard',
      name: 'idcard',
      component: () => import('@/views/IdCard.vue'),
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
  ],
})

export default router