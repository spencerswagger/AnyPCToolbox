#!/usr/bin/env bash
#
# 在下载站服务器用 gh 下载指定 release 用于部署的文件
# （updater.json + 各平台安装包 + .sig），自动过滤掉 web zip 包。
#
# 依赖：
#   - gh CLI 且已登录：`gh auth login`
#   - 对私有仓库有读取权限的 token
#
# 用法：
#   ./download-release.sh v0.0.2                    # 下载到当前目录
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
mkdir -p "$DIR"

echo ">> 从 $REPO 下载 release $TAG -> $DIR"
# 下载全部，随后过滤掉 web zip（web 包应部署到 web 服务器，而非下载站）
gh release download "$TAG" --repo "$REPO" --dir "$DIR" --clobber
rm -f "$DIR"/anypctoolbox-web-*.zip

echo
echo ">> 下载完成，目录内容："
ls -lh "$DIR"

echo
echo ">> 部署提示（baseurl 为下载站根目录，如 http://download.example.com/anypctoolbox/）："
echo "   - updater.json 及所有安装包须放在 baseurl 下，且文件名与 updater.json 内的 url 一致"
echo "   - web 包请另行用 web zip（含 version.json）部署到 web 服务器"