# 项目初始化脚本，设置环境变量等

# 设置项目根目录为环境变量
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
[Environment]::SetEnvironmentVariable("KOA_PROJECT_ROOT", $projectRoot, "User")

Write-Host "✅ 已设置项目根目录环境变量: $projectRoot" -ForegroundColor Green
Write-Host ""
Write-Host "📋 当前配置:" -ForegroundColor Cyan
Write-Host "  项目根目录: $projectRoot" -ForegroundColor Gray

# 检查 .env 文件
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
    Write-Host "  环境文件: 存在" -ForegroundColor Gray
} else {
    Write-Host "  环境文件: 不存在，将创建示例文件" -ForegroundColor Yellow
    Copy-Item (Join-Path $projectRoot ".env.example") $envFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "💡 下次启动 PowerShell 时，环境变量将生效" -ForegroundColor Yellow
Write-Host "   或者运行: . `$env:KOA_PROJECT_ROOT\scripts\dev\init-project.ps1" -ForegroundColor Gray