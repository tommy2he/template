@echo off
chcp 65001 > nul
echo 🚀 设置开发数据库环境
echo ========================================

REM 检查PowerShell版本
powershell -Command "if ($PSVersionTable.PSVersion.Major -lt 5) { Write-Host '❌ 需要PowerShell 5.0或更高版本' -ForegroundColor Red; exit 1 }"

REM 运行设置脚本
powershell -ExecutionPolicy Bypass -File "scripts\dev\setup-db.ps1"

pause
