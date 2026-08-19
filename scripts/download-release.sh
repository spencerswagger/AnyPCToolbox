#!/usr/bin/env bash
#
# 在下载站服务器用 gh 下载指定 release 用于部署的文件。
#
# 目录结构（与 updater.json 内 baseurl/<版本>/<文件> 对应）：
#   <目标目录>/updater.json        # 更新清单（放在下载站根目录）
#   <目标目录>/<版本>/             # 该版本的全部安装包 + .sig（不含 web zip）
#
# 依赖：
#   - gh CLI 且已登录：`gh auth login`
#   - 对私有仓库有读取权限的 token
#
# 用法：
#   ./download-release.sh v0.0.2                    # 输出到 当前目录/updater.json 与 ./v0.0.2/
#   ./download-release.sh v0.0.2 /var/www/anypctoolbox
#   REPO=owner/repo ./download-release.sh v0.0.2 /var/www/anypctoolbox

set -euo pipefail

TAG=""
DIR=""
REPO="${REPO:-spencerswagger/AnyPCToolbox}"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    -h|--help)
      echo "用法: $0 <tag> [目标目录] [--repo owner/repo]"
      echo "示例: $0 v0.0.2 /var/www/anypctoolbox"
      exit 0
      ;;
    *)
      if [ -z "$TAG" ]; then TAG="$1"; elif [ -z "$DIR" ]; then DIR="$1"; fi
      shift
      ;;
  esac
done

if [ -z "$TAG" ]; then
  echo "错误: 缺少版本 tag，例如 $0 v0.0.2" >&2
  exit 1
fi

DIR="${DIR:-$(pwd)}"
VER_DIR="$DIR/$TAG"
mkdir -p "$VER_DIR"

echo ">> 从 $REPO 下载 release $TAG -> $VER_DIR"
gh release download "$TAG" --repo "$REPO" --dir "$VER_DIR" --clobber

# updater.json 放到根目录；版本包留在 <版本> 目录；过滤 web zip 与原始最新清单
if [ -f "$VER_DIR/updater.json" ]; then
  mv -f "$VER_DIR/updater.json" "$DIR/updater.json"
fi
rm -f "$VER_DIR"/anypctoolbox-web-*.zip "$VER_DIR"/latest.json

echo
echo ">> 完成，生成结构："
echo "   [$DIR/updater.json]"
ls -lh "$DIR/updater.json" 2>/dev/null || true
echo "   [$VER_DIR/]"
ls -lh "$VER_DIR"

echo
echo ">> 部署提示（baseurl 为下载站根目录，如 http://download.example.com/anypctoolbox/）："
echo "   - updater.json 已指向 baseurl/$TAG/<文件>，与目录结构一致"
echo "   - web 包请另行用 web zip（含 version.json）部署到 web 服务器"