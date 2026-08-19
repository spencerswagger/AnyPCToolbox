import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

const isTauri = '__TAURI_INTERNALS__' in window
if (
  import.meta.env.PROD &&
  !isTauri &&
  'serviceWorker' in navigator &&
  window.location.protocol.startsWith('http')
) {
  navigator.serviceWorker
    .register(`/sw.js?v=${__APP_VERSION__}`)
    .catch((err) => console.warn('[update] Service Worker 注册失败:', err))
}
