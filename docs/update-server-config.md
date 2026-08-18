# Update Server Configuration

## Overview

The update server serves three types of update metadata:

| File | Purpose | Consumers |
|---|---|---|
| `updater.json` | Tauri desktop update manifest | Tauri desktop app |
| `version.json` | Web app version info | Web app (SPA/PWA) |
| `mobile-update.json` | Mobile app update info | iOS/Android apps |

## Directory Structure

```
/
├── updater.json          # Tauri desktop updater config
├── version.json          # Web app version info
├── mobile-update.json    # Mobile app update info
├── releases/             # Download artifacts
│   ├── v1.0.0/
│   │   ├── anypctoolbox_1.0.0_aarch64-apple-darwin.tar.gz
│   │   ├── anypctoolbox_1.0.0_x86_64-apple-darwin.tar.gz
│   │   ├── anypctoolbox_1.0.0_x86_64-pc-windows-msvc.zip
│   │   ├── anypctoolbox_1.0.0_aarch64-pc-windows-msvc.zip
│   │   ├── anypctoolbox_1.0.0_x86_64-unknown-linux-gnu.tar.gz
│   │   ├── anypctoolbox_1.0.0_aarch64-unknown-linux-gnu.tar.gz
│   │   └── anypctoolbox-web-1.0.0.zip
│   └── ...
```

## API Endpoints

### GET /updater.json
Tauri desktop update check endpoint.

**Response:**
```json
{
  "version": "1.1.0",
  "notes": "Release notes",
  "pub_date": "2026-08-18T10:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "base64-signature",
      "url": "https://cdn.example.com/releases/v1.1.0/anypctoolbox_1.1.0_aarch64-apple-darwin.tar.gz"
    },
    "...": {}
  }
}
```

### GET /version.json
Web app version check endpoint (with cache-busting).

**Response:**
```json
{
  "version": "1.1.0",
  "buildTime": "2026-08-18T10:00:00Z",
  "notes": "Release notes"
}
```

### GET /mobile-update.json
Mobile app update check endpoint.

**Response:**
```json
{
  "version": "1.1.0",
  "buildTime": "2026-08-18T10:00:00Z",
  "downloadUrl": "https://cdn.example.com/releases/v1.1.0/mobile/anypctoolbox-1.1.0.apk",
  "notes": "Release notes",
  "iosUrl": "https://apps.apple.com/app/idXXXX",
  "androidUrl": "https://play.google.com/store/apps/details?id=com.example.app"
}
```

## Cache Strategy

- **`updater.json`**: Cache-Control: max-age=0, must-revalidate (always check latest)
- **`version.json`**: Cache-Control: max-age=60 (1 minute cache for web)
- **`mobile-update.json`**: Cache-Control: max-age=0, must-revalidate
- **Release artifacts**: Cache-Control: public, max-age=31536000, immutable

## Deployment

### Nginx Example

```nginx
server {
    server_name updates.example.com;

    # Update metadata - no cache
    location ~* \.(json)$ {
        root /var/www/updates;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Access-Control-Allow-Origin "*";
    }

    # Release artifacts - long-term cache
    location ~* /releases/ {
        root /var/www/updates;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}
```

### Cloudflare/CDN

1. Upload `updater.json`, `version.json`, `mobile-update.json` to the CDN
2. Set cache-busting headers on JSON files
3. Upload release artifacts with long-term cache settings

## Manual Update Process

```bash
# 1. Build the project
npm run build

# 2. Generate update artifacts
node scripts/generate-update-artifacts.js

# 3. Upload to server
# The script generates files in ./release-artifacts/
# Upload these to your update server or CDN
```
