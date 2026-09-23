<#
  Support Fins 简体中文版 —— 一键启动（Windows）

  用法（任选）：
    双击 start.bat                     # 最省事：起服务 + 自动打开浏览器
    .\start.ps1                        # 同上，默认 http://127.0.0.1:8731/
    .\start.ps1 -Port 8800             # 换端口
    .\start.ps1 -BindHost 0.0.0.0      # 允许局域网内其它设备访问
    .\start.ps1 -NoBrowser             # 只起服务，不打开浏览器
    .\start.ps1 -Help                  # 看帮助

  为什么需要起服务：本应用是「原生 ES 模块 + Web Worker」的纯静态站点，
  浏览器禁止 file:// 下加载模块，双击 index.html 只会白屏。本脚本负责
  找一个空闲端口 → 起 dev-server.py（禁用缓存，改完刷新即生效）→
  等服务真正就绪后再自动打开浏览器。
#>
[CmdletBinding()]
param(
  [int]$Port = 8731,
  [string]$BindHost = '127.0.0.1',
  [switch]$NoBrowser,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$webDir = Join-Path $root 'web'
$server = Join-Path $root 'dev-server.py'

function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }
function Stop-WithMessage([string]$Text) {
  Write-Host ''
  Say "启动失败：$Text" 'Red'
  Say '按 Enter 关闭窗口…' 'DarkGray'
  [void](Read-Host)
  exit 1
}

if ($Help) {
  Say ''
  Say '  start.ps1 [-Port 8731] [-BindHost 127.0.0.1] [-NoBrowser]' 'White'
  Say '  起本地服务并（默认）自动打开浏览器；Ctrl+C 停止。' 'Gray'
  Say ''
  exit 0
}

if (-not (Test-Path (Join-Path $webDir 'index.html'))) {
  Stop-WithMessage "找不到 $webDir\index.html —— 请把本脚本放在仓库根目录（与 web\ 同级）再运行。"
}

# ---------------------------------------------------------------- 1. Python 3
function Resolve-Python {
  $candidates = @(@('python'), @('py', '-3'), @('python3'))
  foreach ($cand in $candidates) {
    $exe = $cand[0]
    $pre = @()
    if ($cand.Count -gt 1) { $pre = $cand[1..($cand.Count - 1)] }
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
    try { $out = (& $exe @pre '--version' 2>&1 | Out-String).Trim() } catch { continue }
    if ($out -match 'Python 3\.') { return [pscustomobject]@{ Exe = $exe; Pre = $pre; Version = $out } }
  }
  return $null
}

$py = Resolve-Python
if (-not $py) {
  Stop-WithMessage @'
没有找到 Python 3。网页应用本身不需要 Python，但本地起静态服务要用它：
  · 到 https://www.python.org/downloads/ 下载安装（安装时勾选 "Add python.exe to PATH"），或
  · 在「Microsoft Store」里搜索 Python 安装；
装好后重新双击 start.bat 即可。
'@
}
Say "Python：$($py.Version)"

# ------------------------------------------------- 2. 选一个能用的端口
function Test-PortFree([int]$P) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $P)
    $l.Start(); $l.Stop(); return $true
  } catch { return $false }
}
function Test-HttpOk([string]$U) {
  try { return (Invoke-WebRequest -Uri $U -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
  catch { return $false }
}

$wildcard = $BindHost -in @('0.0.0.0', '::', '')
$localUrl = "http://127.0.0.1:$Port/"
$chosen = 0

if (Test-PortFree $Port) {
  $chosen = $Port
} elseif (Test-HttpOk $localUrl) {
  # 已经有一个实例在跑（多半是上次没关干净，或用户又点了一次）
  Say ''
  Say "  端口 $Port 上已经有一个实例在运行，直接打开它。" 'Yellow'
  Say "  $localUrl" 'Cyan'
  if (-not $NoBrowser) { Start-Process $localUrl }
  Say '  这个窗口可以直接关掉。' 'DarkGray'
  Start-Sleep -Seconds 2
  exit 0
} else {
  for ($p = $Port + 1; $p -le $Port + 20; $p++) {
    if (Test-PortFree $p) { $chosen = $p; break }
  }
  if (-not $chosen) { Stop-WithMessage "端口 $Port 及其后 20 个端口都被占用了，请用 -Port 指定一个空闲端口。" }
  Say "端口 $Port 被别的程序占用，改用 $chosen。" 'Yellow'
}

$url = if ($wildcard) { "http://127.0.0.1:$chosen/" } else { "http://${BindHost}:$chosen/" }

Say ''
Say '  ── Support Fins 简体中文版 ──────────────────────────────' 'DarkGray'
Say "  地址：$url" 'Cyan'
if ($wildcard) { Say "  局域网：把 127.0.0.1 换成本机 IP，其它设备也能访问" 'DarkGray' }
Say '  停止：在这个窗口按 Ctrl+C' 'DarkGray'
Say '  ─────────────────────────────────────────────────────────' 'DarkGray'
Say ''

# ------------------------------------- 3. 服务就绪后自动打开浏览器
# 直接开浏览器会在服务起来之前白屏，所以先交给一个隐藏的小帮手轮询，
# 拿到 200 再打开；服务本身留在当前窗口前台跑，Ctrl+C 就能干净地停掉。
if (-not $NoBrowser) {
  $opener = "`$u='$url'; for (`$i=0; `$i -lt 60; `$i++) { try { " +
            "Invoke-WebRequest -Uri `$u -UseBasicParsing -TimeoutSec 1 | Out-Null; " +
            "Start-Process `$u; break } catch { Start-Sleep -Milliseconds 400 } }"
  try {
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
                      '-Command', $opener)
  } catch {
    Say '（没能自动打开浏览器，请手动访问上面的地址。）' 'Yellow'
  }
}

# ------------------------------------------------------------- 4. 起服务
$pyArgs = @($py.Pre)          # 例如 py -3 里的 -3；数组为空时 splat 不传任何参数
Push-Location $root
try {
  if (Test-Path $server) {
    & $py.Exe @pyArgs $server $chosen '--host' $BindHost
  } else {
    Say '（没找到 dev-server.py，改用 python -m http.server；它不禁用缓存，改动源码后可能需要强制刷新）' 'DarkGray'
    & $py.Exe @pyArgs '-m' 'http.server' $chosen '--bind' $BindHost '--directory' $webDir
  }
} finally {
  Pop-Location
  Say ''
  Say '服务已停止。' 'DarkGray'
}
