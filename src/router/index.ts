import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAccess } from '@/lib/access/useAccess.ts'
import Home from '@/views/Home.vue'

declare module 'vue-router' {
  interface RouteMeta {
    hidden?: boolean
  }
}

const routes: RouteRecordRaw[] = [
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
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const { canSee } = useAccess()

router.beforeEach((to) => {
  if (to.meta.hidden === true && !canSee(true)) {
    return { name: 'home' }
  }
})

export default router
