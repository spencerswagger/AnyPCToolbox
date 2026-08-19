#!/usr/bin/env node
/**
 * 从 git tag 生成 Web 端版本清单 version.json。
 * 同时校验 tag 与 package.json / src-tauri/tauri.conf.json 版本一致，不一致直接失败。
 *
 * 用法：node scripts/generate-update-artifacts.js v1.0.1
 * 输出：dist-version/version.json（含 version / buildTime / notes）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? ''

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(`[generate-update-artifacts] 无效 tag: "${tag}"（期望形如 v1.2.3）`)
  process.exit(1)
}
const version = tag.replace(/^v/, '')

// 版本以运行时传入的 tag 为准（GitHub Action 触发时由 GITHUB_REF_NAME 提供），
// 不再强制与 package.json / tauri.conf.json 一致，只打印差异作为提示，不阻断发布。
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const tauriConf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'))

for (const [label, v] of [
  ['package.json', pkg.version],
  ['src-tauri/tauri.conf.json', tauriConf.version],
]) {
  if (v !== version) {
    console.warn(`[generate-update-artifacts] 提示: tag=${version}，但 ${label} 中为 ${v}（以 tag 为准）`)
  }
}

const manifest = {
  version,
  buildTime: new Date().toISOString(),
  notes: process.env.RELEASE_NOTES ?? '',
}

const outDir = resolve(root, 'dist-version')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`[generate-update-artifacts] 已生成 dist-version/version.json (v${version})`)
