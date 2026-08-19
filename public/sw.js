/* AnyPCToolbox Service Worker
 * 版本来源：注册 URL 的 ?v= 参数（main.ts 注入 __APP_VERSION__）
 * 策略：HTML 网络优先、version.json 永不缓存、静态资源缓存优先；
 *       新版本激活时清理所有旧版本缓存。
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || '0.0.0'
const CACHE_NAME = `anypctoolbox-${VERSION}`

self.addEventListener('install', () => {
  // 不自动 skipWaiting：等主线程确认新版本后发 SKIP_WAITING 消息
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/version.json') return // 版本清单始终直连，不进缓存
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    /\.(js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|wasm)$/.test(pathname)
  )
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' })
    if (fresh.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, fresh.clone())
    }
    return fresh
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    const root = await caches.match('/')
    return root || Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const fresh = await fetch(request)
  if (fresh.ok && fresh.type === 'basic') {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, fresh.clone())
  }
  return fresh
}
