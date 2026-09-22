#!/usr/bin/env sh
# 启动 Support Fins 简体中文版（Linux / macOS）
#
#   ./start.sh              # http://127.0.0.1:8731/
#   ./start.sh 8800         # 换端口
#   ./start.sh 8731 0.0.0.0 # 允许局域网内其它设备访问
#
# 纯静态站点，无构建步骤：dev-server.py 以禁用缓存的方式提供 web/。
set -e
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
port=${1:-8731}
host=${2:-127.0.0.1}
echo "Support Fins (zh-CN) -> http://$host:$port/"
exec python3 "$here/dev-server.py" "$port" --host "$host"
