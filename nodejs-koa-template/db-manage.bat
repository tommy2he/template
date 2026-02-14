@echo off
echo 📊 数据库管理工具
echo ========================================

if "%1"=="" (
    pwsh -ExecutionPolicy Bypass -File "db\scripts\db-manage.ps1"
) else (
    pwsh -ExecutionPolicy Bypass -File "db\scripts\db-manage.ps1" %*
)

pause