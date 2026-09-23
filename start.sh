#!/usr/bin/env sh
# 启动 Support Fins 简体中文版（Linux / macOS）
#
#   ./start.sh              # http://127.0.0.1:8731/
#   ./start.sh 8800         # 换端口
#   ./start.sh 8731 0.0.0.0 # 允许局域网内其它设备访问
#
# 这个应用是「原生 ES 模块 + Web Worker」的纯静态站点，浏览器禁止 file:// 下加载模块，
# 双击 index.html 只会白屏，必须由本地 HTTP 服务提供。
#
# 两种发行包布局都支持：
#   · 完整源码包：有 web/index.html 与 dev-server.py  → 用 dev-server.py（禁用缓存）
#   · web-only 包：本目录直接就是站点（有 index.html） → 用 python -m http.server
set -e
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
port=${1:-8731}
bind=${2:-127.0.0.1}

if [ -f "$here/web/index.html" ]; then
  site="$here/web"
  if [ -f "$here/dev-server.py" ]; then
    echo "Support Fins (zh-CN) -> http://$bind:$port/   [dev-server.py，禁用缓存]"
    echo "按 Ctrl+C 停止。"
    exec python3 "$here/dev-server.py" "$port" --host "$bind"
  fi
elif [ -f "$here/index.html" ]; then
  site="$here"
else
  echo "启动失败：这里既没有 web/index.html 也没有 index.html。" >&2
  echo "请把 start.sh 放在解压出来的包根目录（与 index.html 或 web/ 同级）再运行。" >&2
  exit 1
fi

# 端口被占用就往后找一个空闲的（用 python3 试绑定，不实际起服务）
if ! python3 -c "import socket,sys; s=socket.socket(); s.bind(('127.0.0.1', int(sys.argv[1]))); s.close()" "$port" 2>/dev/null; then
  newport=$(python3 - "$port" <<'PY'
import socket, sys
start = int(sys.argv[1])
for q in range(start + 1, start + 21):
    s = socket.socket()
    try:
        s.bind(('127.0.0.1', q))
        s.close()
        print(q)
        sys.exit(0)
    except OSError:
        s.close()
sys.exit(1)
PY
) || { echo "端口 $1 及之后 20 个端口都被占用，请自己指定一个空闲端口。" >&2; exit 1; }
  echo "端口 $1 被占用，改用 $newport"
  port=$newport
fi

echo "Support Fins (zh-CN) -> http://$bind:$port/   [静态服务：$site]"
echo "入口文件：$site/index.html（不要在文件管理器里双击它）"
echo "按 Ctrl+C 停止。"
exec python3 -m http.server "$port" --bind "$bind" --directory "$site"
