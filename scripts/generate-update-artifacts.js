import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const version = process.env.VERSION || '1.0.0'
const buildTime = new Date().toISOString()
const changelog = process.env.CHANGELOG || ''

const artifactsDir = resolve(__dirname, '..', 'release-artifacts')
if (!existsSync(artifactsDir)) {
  mkdirSync(artifactsDir, { recursive: true })
}

const baseUrl = process.env.DOWNLOAD_BASE_URL || 'https://updates.example.com'

const versionJson = {
  version,
  buildTime,
  notes: changelog,
  webDownloadUrl: `${baseUrl}/web/`,
}

writeFileSync(resolve(artifactsDir, 'version.json'), JSON.stringify(versionJson, null, 2))

console.log(`Generated update artifacts for version ${version}:`)
console.log(`  - version.json (Web): ${baseUrl}/version.json`)
