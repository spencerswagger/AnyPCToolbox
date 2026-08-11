# AnyPCToolbox Release Automation Design

## Overview

Automate the build and release process for AnyPCToolbox when a version tag (`v*.*.*`) is pushed to GitHub. The workflow produces:

1. **Tauri desktop clients** for Windows (x64, ARM64), macOS (Intel, Apple Silicon), Linux (x64, ARM64)
2. **Web static assets** packaged as a zip archive

All artifacts are uploaded to a draft GitHub Release.

## Workflow Architecture

**File**: `.github/workflows/release.yml`

**Trigger**: `push` events matching tag pattern `v*`

### Job 1: `publish-tauri` (Desktop)

Uses `tauri-apps/tauri-action@v0` with a build matrix:

| Runner | Rust Target | OS/Arch | Output Formats |
|---|---|---|---|
| `macos-latest` | `aarch64-apple-darwin` | macOS Apple Silicon | `.dmg` |
| `macos-latest` | `x86_64-apple-darwin` | macOS Intel | `.dmg` |
| `windows-latest` | `x86_64-pc-windows-msvc` | Windows x64 | `.exe` (NSIS), `.msi` |
| `windows-latest` | `aarch64-pc-windows-msvc` | Windows ARM64 | `.msi` |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | Linux x64 | `.AppImage`, `.deb` |
| `ubuntu-22.04-arm` | `aarch64-unknown-linux-gnu` | Linux ARM64 | `.AppImage` |

Key configuration:
- `fail-fast: false` — one platform failure does not cancel others
- `releaseDraft: true` — creates a draft release for manual review
- `permissions: contents: write` — required to create release and upload artifacts
- Linux dependencies installed via `apt` before build
- macOS universal binary is NOT used; separate builds keep download sizes smaller

### Job 2: `upload-web` (Web Assets)

Runs after `publish-tauri` completes successfully.

Steps:
1. Build the Vite frontend (`npm run build`)
2. Archive the `dist/` directory into `anypctoolbox-web-${{version}}.zip`
3. Upload the zip to the existing draft release using `softprops/action-gh-release`

### Tauri Initialization

The project currently does not have a `src-tauri/` directory. The `tauri-action` supports automatic initialization with the `tauriConfig` input. The workflow will include a minimal `tauri.conf.json` configuration inline.

The user should run `npm create tauri-app` locally to generate the full `src-tauri/` scaffold before the first release, or let the action auto-initialize.

## Matrix Design

### Platform Coverage

- **Windows**: x64 (NSIS installer), ARM64 (MSI only — NSIS does not support ARM64)
- **macOS**: Separate DMG for Intel and Apple Silicon (no universal binary)
- **Linux**: AppImage + deb for x64; AppImage for ARM64

### RPM/Bundle Strategy

- This is a free, open-source tool. No code signing is configured (no Apple Developer ID, no Windows Authenticode).
- macOS binaries will use ad-hoc signing (default for Tauri).
- Windows MSI will be unsigned by default.

## Dependencies

The workflow requires:
- Node.js 20 (setup via `actions/setup-node@v4`)
- Rust stable toolchain (setup via `dtolnay/rust-toolchain@stable`)
- Linux system libraries: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, and others
- `tauri-apps/tauri-action@v0`
- `softprops/action-gh-release@v2`

## Files to Create

### New files

1. `.github/workflows/release.yml` — the main CI/CD workflow

### No changes to existing files

The existing Vue/Vite project files remain unchanged.

## Release Flow

1. Developer pushes a tag: `git push origin v1.0.0`
2. GitHub Actions triggers the workflow
3. All 6 matrix builds run in parallel
4. After all desktop builds complete, the web assets job runs
5. A draft release is created with all artifacts attached
6. Developer reviews and publishes the draft release manually

## Security Considerations

- `GITHUB_TOKEN` is used with minimal permissions (`contents: write`)
- No secrets, API keys, or signing certificates are stored in the workflow
- All build artifacts are ephemeral; only the final release artifacts persist