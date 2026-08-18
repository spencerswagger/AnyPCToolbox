import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { configureUpdate } from './composables/useUpdate'
import './style.css'

configureUpdate({
  versionFileUrl: '/version.json',
  checkIntervalMs: 5 * 60 * 1000,
})

createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && !__TAURI__) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('Service Worker registration failed')
    })
  })

  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true
      window.location.reload()
    }
  })
}