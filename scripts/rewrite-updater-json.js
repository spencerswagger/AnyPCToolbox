#!/usr/bin/env node
/**
 * 重写 tauri 桌面端更新清单(latest.json) 的各平台 url 为 baseurl + 文件名。
 *
 * 背景：tauri-action 生成的 latest.json 各平台 url 默认指向 GitHub Release，
 * 部署到自建下载站后需改为 baseurl 下的同名文件。
 *
 * 用法：node scripts/rewrite-updater-json.js <input.json> <output.json> <baseurl>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , input, output, base] = process.argv
if (!input || !output || !base) {
  console.error('用法: node scripts/rewrite-updater-json.js <input.json> <output.json> <baseurl>')
  process.exit(1)
}

const normalizedBase = base.endsWith('/') ? base : `${base}/`
const manifest = JSON.parse(readFileSync(input, 'utf8'))

if (!manifest.platforms) {
  console.error(`[rewrite-updater-json] ${input} 缺少 platforms 字段`)
  process.exit(1)
}

for (const [plat, entry] of Object.entries(manifest.platforms)) {
  let file = ''
  try {
    file = new URL(entry.url).pathname.split('/').filter(Boolean).pop() ?? ''
  } catch {
    console.warn(`[rewrite-updater-json] ${plat} url 解析失败，跳过: ${entry.url}`)
    continue
  }
  entry.url = `${normalizedBase}${file}`
}

writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n')
const keys = Object.keys(manifest.platforms)
console.log(`[rewrite-updater-json] 已重写 ${keys.length} 个平台 url -> ${normalizedBase}`)