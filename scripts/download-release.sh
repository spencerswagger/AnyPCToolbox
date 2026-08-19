#!/usr/bin/env bash
#
# 在下载站服务器用 gh 下载指定 release 的文件（updater.json + 各平台安装包 + web zip）。
#
# 依赖：
#   - gh CLI 且已登录：`gh auth login`
#   - 对私有仓库有读取权限的 token
#
# 用法：
#   ./download-release.sh v0.0.2                    # 下载到当前目录
#   ./download-release.sh v0.0.2 /var/www/anypctoolbox
#   ./download-release.sh v0.0.2 /var/www/anypctoolbox --pattern '*.exe'
#   REPO=owner/repo ./download-release.sh v0.0.2 /var/www/anypctoolbox
#
# 提示：--pattern 仅下载匹配的文件；不带 pattern 则下载该 release 的全部文件。

set -euo pipefail

TAG=""
DIR=""
PATTERN=""
REPO="${REPO:-spencerswagger/AnyPCToolbox}"

while [ $# -gt 0 ]; do
  case "$1" in
    --pattern) PATTERN="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    -h|--help)
      echo "用法: $0 <tag> [目标目录] [--pattern <glob>] [--repo owner/repo]"
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
if [ -n "$PATTERN" ]; then
  gh release download "$TAG" --repo "$REPO" --dir "$DIR" --pattern "$PATTERN" --clobber
else
  gh release download "$TAG" --repo "$REPO" --dir "$DIR" --clobber
fi

echo
echo ">> 下载完成，目录内容："
ls -lh "$DIR"

echo
echo ">> 部署提示（baseurl 为下载站根目录，如 http://download.example.com/anypctoolbox/）："
echo "   - updater.json 及所有安装包须放在 baseurl 下，且文件名与 updater.json 内的 url 一致"
echo "   - web zip 解压并加上 version.json 后部署到 web 服务器"