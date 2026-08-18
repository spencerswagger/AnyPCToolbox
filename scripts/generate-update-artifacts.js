import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const version = process.env.VERSION || '1.0.0'
const buildTime = new Date().toISOString()
const changelog = process.env.CHANGELOG || ''

const artifactsDir = resolve(__dirname, '..', 'release-artifacts')
if (!existsSync(artifactsDir)) {
  mkdirSync(artifactsDir, { recursive: true })
}

const downloadBaseUrl = process.env.DOWNLOAD_BASE_URL || `https://cdn.example.com/releases/v${version}`

const updaterJson = {
  version,
  notes: changelog || `${version} 更新`,
  pub_date: buildTime,
  platforms: {
    'darwin-aarch64': {
      signature: '',
      url: `${downloadBaseUrl}/anypctoolbox_${version}_aarch64-apple-darwin.tar.gz`,
    },
    'darwin-x86_64': {
      signature: '',
      url: `${downloadBaseUrl}/anypctoolbox_${version}_x86_64-apple-darwin.tar.gz`,
    },
    'windows-x86_64': {
      signature: '',
      url: `${downloadBaseUrl}/anypctoolbox_${version}_x86_64-pc-windows-msvc.zip`,
    },
    'windows-aarch64': {
      signature: '',
      url: `${downloadBaseUrl}/anypctoolbox_${version}_aarch64-pc-windows-msvc.zip`,
    },
    'linux-x86_64': {
      signature: '',
      url: `${downloadBaseUrl}/anypctoolbox_${version}_x86_64-unknown-linux-gnu.tar.gz`,
    },
    'linux-aarch64': {
      signature: '',
      url: `${downloadBaseUrl}/anypctoolbox_${version}_aarch64-unknown-linux-gnu.tar.gz`,
    },
  },
}

writeFileSync(resolve(artifactsDir, 'updater.json'), JSON.stringify(updaterJson, null, 2))

const versionJson = {
  version,
  buildTime,
  notes: changelog,
}

writeFileSync(resolve(artifactsDir, 'version.json'), JSON.stringify(versionJson, null, 2))

const mobileUpdateJson = {
  version,
  buildTime,
  downloadUrl: `${downloadBaseUrl}/mobile/anypctoolbox-${version}.apk`,
  notes: changelog,
  iosUrl: `https://apps.apple.com/app/id${process.env.IOS_APP_ID || ''}`,
  androidUrl: `https://play.google.com/store/apps/details?id=${process.env.ANDROID_PACKAGE || ''}`,
}

writeFileSync(resolve(artifactsDir, 'mobile-update.json'), JSON.stringify(mobileUpdateJson, null, 2))

console.log(`Generated update artifacts for version ${version}:`)
console.log(`  - updater.json (Tauri desktop)`)
console.log(`  - version.json (Web)`)
console.log(`  - mobile-update.json (Mobile)`)
