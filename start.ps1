# 启动 Support Fins 简体中文版（Windows）
#
#   .\start.ps1                       # http://127.0.0.1:8731/
#   .\start.ps1 -Port 8800            # 换端口
#   .\start.ps1 -BindHost 0.0.0.0     # 允许局域网内其它设备访问
#
# 应用是无构建步骤的纯静态 ES 模块站点（three.js 内置于 web/vendor/），
# dev-server.py 只做一件事：以「禁用缓存」的方式把 web/ 提供出去，
# 这样改完源码刷新即可生效，不会被浏览器的启发式缓存骗到。
param(
  [int]$Port = 8731,
  [string]$BindHost = '127.0.0.1'
)

$server = Join-Path $PSScriptRoot 'dev-server.py'
if (-not (Test-Path $server)) {
  Write-Error "找不到 $server"
  exit 1
}

Write-Host "Support Fins (zh-CN) -> http://$BindHost`:$Port/"
python $server $Port --host $BindHost
