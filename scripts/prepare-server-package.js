#!/usr/bin/env node
/**
 * 生成「服务器套件」：供手动上传到下载站目录。
 *
 * 背景：tauri-action 生成的 updater.json(latest.json) 里各平台 url 默认指向 GitHub
 * Release，若直接部署会把更新包拉去私有仓库导致失败。本脚本把每个平台 url 改写为
 * baseurl + 文件名，并把对应安装包下载到一个 server-package/ 文件夹。
 *
 * 用法：
 *   node scripts/prepare-server-package.js <baseurl> [tag] [--token <gh_token>]
 *
 *   baseurl  下载站目录，如 http://download.example.com/anypctoolbox/
 *   tag      要出包的发布标签，缺省取最近一个 v* 标签；示例 v0.0.2
 *   解析对象: 从 git remote origin 读取 owner/repo，可用 GH_REPO 覆盖。
 *   token    私有仓库拉取资产需要；缺省读环境变量 GITHUB_TOKEN。
 *
 * 输出：server-package/updater.json + 各平台安装包，直接上传到 baseurl 即可。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, 'server-package')

function usage(msg) {
  console.error(`[prepare-server-package] ${msg}`)
  console.error('用法: node scripts/prepare-server-package.js <baseurl> [tag] [--token <gh_token>]')
  process.exit(1)
}

// ---- 解析参数 ----
const argv = process.argv.slice(2)
const baseurlArg = argv[0]
const tokenIdx = argv.indexOf('--token')
let tag = argv[1] === '--token' ? '' : (argv[1] ?? '')
const token = tokenIdx >= 0 && argv[tokenIdx + 1] != null ? argv[tokenIdx + 1] : (process.env.GITHUB_TOKEN ?? '')

if (!baseurlArg) usage('缺少 baseurl')
const base = baseurlArg.endsWith('/') ? baseurlArg : `${baseurlArg}/`

// ---- 解析 owner/repo ----
const envRepo = process.env.GH_REPO || process.env.GITHUB_REPOSITORY || ''
let owner = ''
let repo = ''
if (envRepo.includes('/')) {
  ;[owner, repo] = envRepo.split('/', 2)
} else {
  try {
    const remote = (readFileSync(resolve(root, '.git', 'config'), 'utf8') + '\n' + safeRead('.git/remotes/origin/url')).match(/github\.com[:/]([^/]+)\/([^/\.]+)/)
    if (remote) {
      ;[owner, repo] = [remote[1], remote[2]]
    }
  } catch {
    /* ignore */
  }
}
if (!owner || !repo) usage('无法解析 owner/repo，请设置环境变量 GH_REPO=owner/repo')

// ---- 确定 tag ----
if (!tag) {
  const list = await gh(`/repos/${owner}/${repo}/tags?per_page=100`, token)
  const vs = list.map((t) => t.name).filter((n) => /^v\d+\.\d+\.\d+$/.test(n))
  if (!vs.length) usage('未找到 v* 标签')
  tag = vs.sort((a, b) => cmp(b, a))[0]
}
console.log(`[prepare-server-package] repo=${owner}/${repo} tag=${tag} base=${base}`)

// ---- 用 release 里的 latest.json 改写 url，并下载资产 ----
const release = await gh(`/repos/${owner}/${repo}/releases/tags/${tag}`, token)
const latestAsset = release.assets.find((a) => a.name === 'latest.json')
if (!latestAsset) usage(`release ${tag} 中没有 latest.json（未开启 tauri updater 产物）`)

const manifest = await (async () => {
  const res = await ghauth(latestAsset.url, token)
  if (!res.ok) throw new Error(`下载 latest.json 失败: HTTP ${res.status}`)
  return res.json()
})()

if (!manifest.platforms) usage('latest.json 缺少 platforms 字段')

mkdirSync(outDir, { recursive: true })
const rewritten = JSON.parse(JSON.stringify(manifest))
const renamed = new Set()
for (const [plat, entry] of Object.entries(rewritten.platforms)) {
  const file = basename(new URL(entry.url).pathname)
  entry.url = `${base}${file}`
  renamed.add(file)
}
writeFileSync(resolve(outDir, 'updater.json'), JSON.stringify(rewritten, null, 2) + '\n')
console.log(`[prepare-server-package] 已改写 updater.json（${Object.keys(rewritten.platforms).length} 个平台）`)

// ---- 下载各平台安装包 ----
const assetNames = new Set(release.assets.map((a) => a.name))
for (const file of renamed) {
  if (!assetNames.has(file)) {
    console.warn(`[prepare-server-package] 警告: 资产 ${file} 不在 release 中，跳过（请手动上传同名文件）`)
    continue
  }
  const asset = release.assets.find((a) => a.name === file)
  const res = await ghauth(asset.url, token)
  if (!res.ok) {
    console.warn(`[prepare-server-package] 警告: 下载 ${file} 失败 HTTP ${res.status}`)
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(resolve(outDir, file), buf)
  console.log(`[prepare-server-package] 已下载 ${file} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
}

console.log(
  `\n完成。将 server-package/ 下所有文件上传到 ${base}\n` +
    '  即 updater.json + 所有安装包文件。endpoint(UPDATER_ENDPOINT) 应设为 ' +
    `${base}updater.json`,
)

// ---- helpers ----
function safeRead(p) {
  try {
    return readFileSync(`${root}/${p}`, 'utf8')
  } catch {
    return ''
  }
}
async function ghauth(url, tok = '') {
  return fetch(url, {
    headers: tok ? { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json' } : { Accept: 'application/vnd.github+json' },
  })
}
async function gh(path, tok = '') {
  const res = await ghauth(`https://api.github.com${path}`, tok)
  if (!res.ok) throw new Error(`GitHub API ${path} 失败: HTTP ${res.status}`)
  return res.json()
}
function cmp(a, b) {
  const na = a.replace(/^v/, '').split('.').map(Number)
  const nb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const d = (na[i] ?? 0) - (nb[i] ?? 0)
    if (d) return d
  }
  return 0
}