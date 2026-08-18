# 自动更新部署指南

## 服务器目录结构

```
/var/www/
├── web/
│   ├── index.html              # Web 应用入口
│   ├── assets/                 # Vite 构建产物
│   ├── updater.json            # Tauri 桌面端更新清单
│   └── version.json            # Web 端版本信息
└── releases/
    └── v1.0.0/
        ├── anypctoolbox_1.0.0_aarch64-apple-darwin.tar.gz
        ├── anypctoolbox_1.0.0_x86_64-apple-darwin.tar.gz
        ├── anypctoolbox_1.0.0_x86_64-pc-windows-msvc.zip
        ├── anypctoolbox_1.0.0_aarch64-pc-windows-msvc.zip
        ├── anypctoolbox_1.0.0_x86_64-unknown-linux-gnu.tar.gz
        └── anypctoolbox_1.0.0_aarch64-unknown-linux-gnu.tar.gz
```

## Nginx 配置

```nginx
server {
    listen 80;
    server_name updates.example.com;

    # Web 应用
    root /var/www/web;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 桌面安装包
    location /releases/ {
        alias /var/www/releases/;
        autoindex on;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

## GitHub Actions 变量

在仓库 Settings → Secrets and variables → Actions → Variables 中配置：

| 变量 | 示例值 | 说明 |
|---|---|---|
| `DOWNLOAD_BASE_URL` | `https://updates.example.com` | 你的服务器域名（不含尾部斜杠） |

此变量用于：
1. 生成 `updater.json` 中桌面安装包的下载 URL
2. 设置 Tauri 的 updater endpoint

## 手动部署步骤

```bash
# 版本号
VERSION=1.0.0
OWNER=your-github-username
REPO=anypctoolbox

# 1. 从 GitHub Release 下载所有制品
curl -sL "https://api.github.com/repos/$OWNER/$REPO/releases/tags/v$VERSION" \
  | grep "browser_download_url" \
  | grep -E "\.(json|zip|tar\.gz)" \
  | cut -d '"' -f 4 \
  | xargs -I{} wget -q {}

# 2. 部署 Web
rm -rf /var/www/web/*
unzip -o anypctoolbox-web-v$VERSION.zip -d /var/www/web/
mv updater.json version.json /var/www/web/

# 3. 部署桌面安装包
mkdir -p /var/www/releases/v$VERSION/
mv anypctoolbox_*.tar.gz anypctoolbox_*.zip /var/www/releases/v$VERSION/

# 4. 清理下载的制品
rm -f anypctoolbox-*.tar.gz anypctoolbox-*.zip updater.json version.json
```

更新后文件结构：

| URL | 实际路径 | 用途 |
|---|---|---|
| `https://updates.example.com/` | `/var/www/web/index.html` | Web 应用 |
| `https://updates.example.com/updater.json` | `/var/www/web/updater.json` | Tauri 更新检查 |
| `https://updates.example.com/version.json` | `/var/www/web/version.json` | Web 版本检查 |
| `https://updates.example.com/releases/v1.0.0/*` | `/var/www/releases/v1.0.0/*` | 桌面安装包下载 |
