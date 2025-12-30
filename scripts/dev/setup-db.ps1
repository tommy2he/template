# 导入环境工具函数

# Import-Module (Join-Path $PSScriptRoot "..\utils\env.ps1") -Force
. (Join-Path $PSScriptRoot "..\utils\env.ps1")

# 获取项目根目录
$ProjectRoot = Get-ProjectRoot
Write-Host "📁 项目根目录: $ProjectRoot" -ForegroundColor Gray

# 加载环境变量
$envVars = Import-EnvFile -ProjectRoot $ProjectRoot

# 获取配置（支持环境变量和默认值）
$DataDir = Get-EnvValue -Key "MONGODB_DATA_DIR" -DefaultValue "D:\docker\mongodb\data" -EnvVars $envVars
$BackupDir = Get-EnvValue -Key "MONGODB_BACKUP_DIR" -DefaultValue "db/backups" -EnvVars $envVars

# 解析路径（如果是相对路径，转换为绝对路径）
$DataDir = Resolve-PathWithRoot -Path $DataDir -ProjectRoot $ProjectRoot
$BackupDir = Resolve-PathWithRoot -Path $BackupDir -ProjectRoot $ProjectRoot

Write-Host "🚀 设置开发数据库环境" -ForegroundColor Cyan
Write-Host "=" * 50
Write-Host "配置:" -ForegroundColor Yellow
Write-Host "  数据目录: $DataDir" -ForegroundColor Gray
Write-Host "  备份目录: $BackupDir" -ForegroundColor Gray
Write-Host ""

# 启动数据库时设置环境变量
$env:MONGODB_DATA_DIR = $DataDir
$DockerComposeFile = Join-Path $ProjectRoot "docker\config\docker-compose.yml"
$TestConnectionScript = Join-Path $ProjectRoot "db\scripts\test-connection.js"

# 1. 检查Docker
Write-Host "1. 检查Docker状态..." -ForegroundColor Yellow
# $dockerRunning = docker info 2>$null
docker info 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker未运行，请启动Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Docker正在运行" -ForegroundColor Green

# 2. 检查MongoDB镜像
Write-Host "`n2. 检查MongoDB镜像..." -ForegroundColor Yellow
$mongoImage = docker images --quiet mongo:6 2>$null
if (-not $mongoImage) {
    Write-Host "   ⚠️  MongoDB镜像不存在，正在下载..." -ForegroundColor Yellow
    docker pull mongo:6 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ 下载MongoDB镜像失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ MongoDB镜像下载完成" -ForegroundColor Green
} else {
    Write-Host "   ✅ MongoDB镜像已存在" -ForegroundColor Green
}

# 3. 创建数据目录
Write-Host "`n3. 创建数据目录..." -ForegroundColor Yellow
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    Write-Host "   ✅ 创建目录: $DataDir" -ForegroundColor Green
} else {
    Write-Host "   ✅ 目录已存在: $DataDir" -ForegroundColor Green
}

# 创建备份目录
Write-Host "`n3.1 创建备份目录..." -ForegroundColor Yellow
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "   ✅ 创建目录: $BackupDir" -ForegroundColor Green
} else {
    Write-Host "   ✅ 目录已存在: $BackupDir" -ForegroundColor Green
}

# 4. 启动数据库
Write-Host "`n4. 启动MongoDB数据库..." -ForegroundColor Yellow
Write-Host "   📄 使用配置文件: $DockerComposeFile" -ForegroundColor Gray

# 设置环境变量供docker-compose使用
$env:MONGODB_DATA_DIR = $DataDir

docker-compose -f $DockerComposeFile up -d mongodb 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ 启动数据库失败" -ForegroundColor Red
    Write-Host "   尝试手动运行: docker-compose -f `"$DockerComposeFile`" up -d mongodb" -ForegroundColor Yellow
    exit 1
}

# 5. 等待数据库就绪
Write-Host "   ⏳ 等待数据库就绪..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$connected = $false

while ($attempt -lt $maxAttempts -and -not $connected) {
    $attempt++
    Write-Host "   尝试连接 ($attempt/$maxAttempts)..." -ForegroundColor Gray
    # $testResult = node $TestConnectionScript 2>&1
    node $TestConnectionScript 2>&1
    if ($LASTEXITCODE -eq 0) {
        $connected = $true
    } else {
        Start-Sleep -Seconds 2
    }
}

if ($connected) {
    Write-Host "   ✅ 数据库启动成功" -ForegroundColor Green
} else {
    Write-Host "   ❌ 数据库启动超时" -ForegroundColor Red
    Write-Host "`n查看日志:" -ForegroundColor Yellow
    docker-compose -f $DockerComposeFile logs mongodb --tail=20
    exit 1
}

# 6. 显示连接信息
Write-Host "`n5. 数据库连接信息:" -ForegroundColor Yellow
Write-Host ""

# 从环境变量获取连接字符串
$MongoDBUri = Get-EnvValue -Key "MONGODB_URI" -DefaultValue "mongodb://koa_user:koa_password@localhost:27017/koa_template_dev" -EnvVars $envVars
$MongoDBAdminUri = Get-EnvValue -Key "MONGODB_ADMIN_URI" -DefaultValue "mongodb://admin:secret@localhost:27017/admin" -EnvVars $envVars

Write-Host "  应用连接字符串:" -ForegroundColor Gray
Write-Host "    $MongoDBUri" -ForegroundColor White
Write-Host ""
Write-Host "  管理员连接字符串:" -ForegroundColor Gray
Write-Host "    $MongoDBAdminUri" -ForegroundColor White
Write-Host ""
Write-Host "  Web管理界面:" -ForegroundColor Gray
Write-Host "    http://localhost:8081" -ForegroundColor White
Write-Host ""
Write-Host "  测试连接:" -ForegroundColor Gray
Write-Host "    node $TestConnectionScript" -ForegroundColor White
Write-Host ""
Write-Host "  管理数据库:" -ForegroundColor Gray
Write-Host "    npm run db:shell" -ForegroundColor White
Write-Host ""

# 7. 测试连接
Write-Host "`n6. 最终连接测试..." -ForegroundColor Yellow
node $TestConnectionScript

Write-Host "`n" + "=" * 50
Write-Host "✅ 开发数据库环境设置完成！" -ForegroundColor Green
Write-Host "=" * 50
Write-Host ""
Write-Host "📋 后续操作建议:" -ForegroundColor Cyan
Write-Host "  1. 运行数据库状态检查: npm run db:status" -ForegroundColor Gray
Write-Host "  2. 打开MongoDB管理界面: http://localhost:8081" -ForegroundColor Gray
Write-Host "  3. 登录信息:" -ForegroundColor Gray
Write-Host "     用户名: admin" -ForegroundColor Gray
Write-Host "     密码: express" -ForegroundColor Gray
Write-Host ""