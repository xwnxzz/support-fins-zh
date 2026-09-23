@echo off
rem ============================================================================
rem  Support Fins (Simplified Chinese edition) - one-click launcher for Windows
rem
rem  Just double-click this file: it finds Python 3, picks a free port, starts
rem  the local server and opens your browser once the server answers.
rem  To stop it, press Ctrl+C in the console window.
rem
rem  All the real work (and every Chinese message) lives in start.ps1 next to
rem  this file. This file is deliberately ASCII-only: cmd.exe mis-parses batch
rem  files that contain multi-byte characters, especially after a chcp switch,
rem  which split the Chinese lines into bogus commands.
rem
rem  Optional arguments:  start.bat -Port 8800
rem                       start.bat -BindHost 0.0.0.0
rem                       start.bat -NoBrowser
rem                       start.bat -Help
rem ============================================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] powershell.exe not found. Run start.ps1 with PowerShell instead.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo Launcher exited with code %RC%.
  pause
)

endlocal
