#!/usr/bin/env node
/**
 * 重写 tauri 桌面端更新清单(latest.json) 的各平台 url 为 baseurl + 版本号 + 文件名。
 *
 * 背景：tauri-action 生成的 latest.json 各平台 url 默认指向 GitHub Release，
 * 下载站采用 baseurl/<版本号>/<文件> 的目录结构，部署时需改写为：
 *     <baseurl>/<版本>/<文件名>
 *
 * 用法：node scripts/rewrite-updater-json.js <input.json> <output.json> <baseurl> <version>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , input, output, base, version] = process.argv
if (!input || !output || !base || !version) {
  console.error('用法: node scripts/rewrite-updater-json.js <input> <output> <baseurl> <version>')
  process.exit(1)
}

const normalizedBase = base.endsWith('/') ? base : `${base}/`
const manifest = JSON.parse(readFileSync(input, 'utf8'))

if (!manifest.platforms) {
  console.error(`[rewrite-updater-json] ${input} 缺少 platforms 字段`)
  process.exit(1)
}

let changed = 0
for (const [plat, entry] of Object.entries(manifest.platforms)) {
  let file = ''
  try {
    file = new URL(entry.url).pathname.split('/').filter(Boolean).pop() ?? ''
  } catch {
    console.warn(`[rewrite-updater-json] ${plat} url 解析失败，跳过: ${entry.url}`)
    continue
  }
  entry.url = `${normalizedBase}${version}/${file}`
  changed++
}

writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n')
console.log(`[rewrite-updater-json] 已重写 ${changed} 个平台 url -> ${normalizedBase}${version}/`)