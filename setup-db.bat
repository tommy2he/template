@echo off
chcp 65001 > nul
echo 🚀 设置开发数据库环境
echo ========================================

REM 检查pwsh版本
pwsh -Command "if ($PSVersionTable.PSVersion.Major -lt 5) { Write-Host '❌ 需要pwsh 5.0或更高版本' -ForegroundColor Red; exit 1 }"

REM 运行设置脚本
pwsh -ExecutionPolicy Bypass -File "scripts\dev\setup-db.ps1"

pause
