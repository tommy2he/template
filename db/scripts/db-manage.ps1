param(
    [string]$Command = "help"
)

# 动态获取项目根目录（不硬编码！）
$ProjectRoot = Join-Path $PSScriptRoot "..\.." | Resolve-Path
$DockerComposeFile = Join-Path $ProjectRoot "docker\config\docker-compose.yml"

# 从 .env 文件读取配置（如果没有则使用默认值）
function Get-EnvVar {
    param([string]$Key, [string]$DefaultValue)
    
    # 首先尝试从环境变量读取
    $value = [Environment]::GetEnvironmentVariable($Key)
    if ($value) { return $value }
    
    # 然后尝试从 .env 文件读取
    $envFile = Join-Path $ProjectRoot ".env"
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        foreach ($line in $content) {
            if ($line.Trim() -and -not $line.StartsWith('#')) {
                $parts = $line.Split('=', 2)
                if ($parts[0].Trim() -eq $Key -and $parts.Length -eq 2) {
                    return $parts[1].Trim()
                }
            }
        }
    }
    
    # 最后使用默认值
    return $DefaultValue
}

# 获取配置
$DataDir = Get-EnvVar "MONGODB_DATA_DIR" "D:\docker\mongodb\data"
$BackupDir = Get-EnvVar "MONGODB_BACKUP_DIR" "db/backups"

# 确保路径是绝对路径（如果是相对路径，则基于项目根目录）
if (-not [System.IO.Path]::IsPathRooted($DataDir)) {
    $DataDir = Join-Path $ProjectRoot $DataDir
}

if (-not [System.IO.Path]::IsPathRooted($BackupDir)) {
    $BackupDir = Join-Path $ProjectRoot $BackupDir
}

function Show-Header {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  数据库管理工具 - Koa Template App" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📁 项目根目录: $ProjectRoot" -ForegroundColor Gray
    Write-Host "💾 数据目录: $DataDir" -ForegroundColor Gray
}

function Test-DbConnection {
    Write-Host "🧪 测试数据库连接..." -ForegroundColor Blue
    $testScript = Join-Path $ProjectRoot "db\scripts\test-connection.js"
    node $testScript
}

function Get-DbStatus {
    Write-Host "📊 数据库状态:" -ForegroundColor Cyan
    docker-compose -f $DockerComposeFile ps mongodb 2>$null
    
    Write-Host "`n💾 数据存储位置: $DataDir" -ForegroundColor Cyan
    if (Test-Path $DataDir) {
        $size = (Get-ChildItem $DataDir -Recurse | Measure-Object -Property Length -Sum).Sum
        Write-Host "  总大小: $([math]::Round($size/1MB, 2)) MB" -ForegroundColor Gray
        $fileCount = (Get-ChildItem $DataDir -Recurse -File).Count
        Write-Host "  文件数: $fileCount" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  数据目录不存在" -ForegroundColor Yellow
    }
}

switch ($Command.ToLower()) {
    "start" {
        Show-Header
        Write-Host "🚀 启动MongoDB数据库..." -ForegroundColor Green
        
        # 确保数据目录存在
        if (-not (Test-Path "$DataDir\data")) {
            Write-Host "📁 创建数据目录..." -ForegroundColor Yellow
            New-Item -ItemType Directory -Path "$DataDir\data" -Force | Out-Null
        }
        
        docker-compose -f $DockerComposeFile up -d mongodb
        Write-Host "✅ 数据库启动完成" -ForegroundColor Green
        Write-Host "⏳ 等待数据库就绪（5秒）..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        Get-DbStatus
        Test-DbConnection
    }
    
    "stop" {
        Show-Header
        Write-Host "🛑 停止数据库..." -ForegroundColor Yellow
        docker-compose -f $DockerComposeFile down
        Write-Host "✅ 数据库已停止" -ForegroundColor Green
    }
    
    "status" {
        Show-Header
        Get-DbStatus
        Test-DbConnection
    }
    
    "logs" {
        Show-Header
        Write-Host "📋 查看数据库日志..." -ForegroundColor Cyan
        docker-compose -f $DockerComposeFile logs -f mongodb
    }
    
    "shell" {
        Show-Header
        Write-Host "🐚 进入MongoDB Shell..." -ForegroundColor Magenta
        Write-Host "  用户: admin" -ForegroundColor Gray
        Write-Host "  数据库: admin" -ForegroundColor Gray
        Write-Host ""
        docker exec -it koa_mongodb mongosh -u admin -p secret --authenticationDatabase admin
    }
    
    "app-shell" {
        Show-Header
        Write-Host "🐚 进入应用数据库Shell..." -ForegroundColor Magenta
        Write-Host "  用户: koa_user" -ForegroundColor Gray
        Write-Host "  数据库: koa_template_dev" -ForegroundColor Gray
        Write-Host ""
        docker exec -it koa_mongodb mongosh -u koa_user -p koa_password --authenticationDatabase koa_template_dev koa_template_dev
    }
    
    "reset" {
        Show-Header
        Write-Host "🔄 重置数据库（删除所有数据）..." -ForegroundColor Red -BackgroundColor Black
        Write-Host "⚠️  警告: 这将删除所有数据库数据！" -ForegroundColor Red
        Write-Host ""
        $confirmation = Read-Host "确认重置？输入 'yes' 继续: "
        if ($confirmation -eq 'yes') {
            Write-Host "停止容器..." -ForegroundColor Yellow
            docker-compose -f $DockerComposeFile down
            
            Write-Host "删除数据目录..." -ForegroundColor Yellow
            if (Test-Path "$DataDir\data") {
                Remove-Item -Path "$DataDir\data" -Recurse -Force
                Write-Host "✅ 数据已删除" -ForegroundColor Green
            }
            
            Write-Host "重新启动数据库..." -ForegroundColor Yellow
            docker-compose -f $DockerComposeFile up -d mongodb
            
            Write-Host "⏳ 等待初始化（10秒）..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
            
            Write-Host "✅ 数据库已重置" -ForegroundColor Green
            Get-DbStatus
        } else {
            Write-Host "❌ 取消重置操作" -ForegroundColor Yellow
        }
    }
    
    "backup" {
        Show-Header
        Write-Host "💾 备份数据库..." -ForegroundColor Cyan
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupDir = "$ProjectRoot\db\backups\backup_$timestamp"
        
        # 创建备份目录
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        
        # 执行备份
        Write-Host "正在备份到: $backupDir" -ForegroundColor Gray
        docker exec koa_mongodb mongodump --uri="mongodb://admin:secret@localhost:27018" --out=/tmp/backup_$timestamp
        
        # 复制到主机
        docker cp koa_mongodb:/tmp/backup_$timestamp $backupDir
        
        # 压缩备份
        Write-Host "压缩备份文件..." -ForegroundColor Gray
        Compress-Archive -Path "$backupDir\*" -DestinationPath "$backupDir.zip" -Force
        
        # 清理临时文件
        Remove-Item -Path $backupDir -Recurse -Force
        
        $size = (Get-Item "$backupDir.zip").Length / 1MB
        Write-Host "✅ 备份完成: $backupDir.zip ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    }
    
    "restore" {
        Show-Header
        Write-Host "📤 恢复数据库..." -ForegroundColor Cyan
        
        # 列出可用的备份
        $backupDir = "$ProjectRoot\db\backups"
        if (-not (Test-Path $backupDir)) {
            Write-Host "❌ 备份目录不存在: $backupDir" -ForegroundColor Red
            return
        }
        
        $backups = Get-ChildItem -Path $backupDir -Filter "*.zip" | Sort-Object LastWriteTime -Descending
        
        if ($backups.Count -eq 0) {
            Write-Host "❌ 没有找到备份文件" -ForegroundColor Red
            return
        }
        
        Write-Host "可用的备份文件:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $backups.Count; $i++) {
            Write-Host "  [$i] $($backups[$i].Name) ($(Get-Date $backups[$i].LastWriteTime -Format 'yyyy-MM-dd HH:mm'))" -ForegroundColor Gray
        }
        
        $choice = Read-Host "`n选择要恢复的备份编号 (0-$($backups.Count-1))"
        if ($choice -match '^\d+$' -and [int]$choice -lt $backups.Count) {
            $backupFile = $backups[[int]$choice].FullName
            $tempDir = "$env:TEMP\mongodb_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            
            Write-Host "正在恢复: $($backups[[int]$choice].Name)" -ForegroundColor Yellow
            
            # 解压备份
            Expand-Archive -Path $backupFile -DestinationPath $tempDir -Force
            
            # 恢复数据库
            docker exec koa_mongodb mongorestore --uri="mongodb://admin:secret@localhost:27018" --drop $tempDir
            
            # 清理临时文件
            Remove-Item -Path $tempDir -Recurse -Force
            
            Write-Host "✅ 数据库恢复完成" -ForegroundColor Green
        } else {
            Write-Host "❌ 无效的选择" -ForegroundColor Red
        }
    }
    
    "test" {
        Show-Header
        Test-DbConnection
    }
    
    "info" {
        Show-Header
        Write-Host "📋 数据库连接信息:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  应用连接字符串:" -ForegroundColor Gray
        Write-Host "    mongodb://koa_user:koa_password@localhost:27018/koa_template_dev" -ForegroundColor White
        Write-Host ""
        Write-Host "  管理员连接字符串:" -ForegroundColor Gray
        Write-Host "    mongodb://admin:secret@localhost:27018/admin" -ForegroundColor White
        Write-Host ""
        Write-Host "  数据存储位置:" -ForegroundColor Gray
        Write-Host "    D:\docker\mongodb\data" -ForegroundColor White
        Write-Host ""
        Write-Host "  Docker Compose文件:" -ForegroundColor Gray
        Write-Host "    $DockerComposeFile" -ForegroundColor White
    }

    "migrate" {
        Show-Header
        Write-Host "🔄 运行数据库迁移..." -ForegroundColor Cyan
        
        # 检查是否安装了迁移工具
        $migrateScript = Join-Path $ProjectRoot "db\scripts\migrate.js"
        if (Test-Path $migrateScript) {
            node $migrateScript
        } else {
            Write-Host "❌ 迁移脚本不存在: $migrateScript" -ForegroundColor Red
            Write-Host "请先创建迁移脚本" -ForegroundColor Yellow
        }
    }

    "seed" {
        Show-Header
        Write-Host "🌱 运行数据库种子数据..." -ForegroundColor Cyan
        
        # 检查是否安装了种子脚本
        $seedScript = Join-Path $ProjectRoot "db\scripts\seed.js"
        if (Test-Path $seedScript) {
            node $seedScript
        } else {
            Write-Host "❌ 种子脚本不存在: $seedScript" -ForegroundColor Red
            Write-Host "请先创建种子脚本" -ForegroundColor Yellow
        }
    }

    "express:start" {
        Show-Header
        Write-Host "🌐 启动Mongo Express Web界面..." -ForegroundColor Green
        docker-compose -f $DockerComposeFile up -d mongo-express
        Write-Host "✅ Mongo Express启动完成" -ForegroundColor Green
        Write-Host "⏳ 等待服务就绪（3秒）..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        Write-Host "📊 访问地址: http://localhost:8081" -ForegroundColor Cyan
        Write-Host "🔑 登录信息: 用户名: admin, 密码: express" -ForegroundColor Cyan
    }
    
    "express:stop" {
        Show-Header
        Write-Host "🛑 停止Mongo Express..." -ForegroundColor Yellow
        docker-compose -f $DockerComposeFile stop mongo-express
        Write-Host "✅ Mongo Express已停止" -ForegroundColor Green
    }
    
    "express:logs" {
        Show-Header
        Write-Host "📋 查看Mongo Express日志..." -ForegroundColor Cyan
        docker-compose -f $DockerComposeFile logs -f mongo-express
    }
    
    "express:status" {
        Show-Header
        Write-Host "📊 Mongo Express状态:" -ForegroundColor Cyan
        docker-compose -f $DockerComposeFile ps mongo-express 2>$null
        
        # 检查端口是否可访问
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8081" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ 服务状态: 运行正常" -ForegroundColor Green
                Write-Host "🌐 访问地址: http://localhost:8081" -ForegroundColor White
            }
        } catch {
            Write-Host "⚠️  服务状态: 可能未运行或启动中" -ForegroundColor Yellow
        }
    }
    
    "express:open" {
        Show-Header
        Write-Host "🌐 在浏览器中打开Mongo Express..." -ForegroundColor Magenta
        Start-Process "http://localhost:8081"
        Write-Host "✅ 浏览器已打开" -ForegroundColor Green
    }
    
    "start-all" {
        Show-Header
        Write-Host "🚀 启动所有数据库服务 (MongoDB + Mongo Express)..." -ForegroundColor Green
        
        # 确保数据目录存在
        if (-not (Test-Path "$DataDir\data")) {
            Write-Host "📁 创建数据目录..." -ForegroundColor Yellow
            New-Item -ItemType Directory -Path "$DataDir\data" -Force | Out-Null
        }
        
        docker-compose -f $DockerComposeFile up -d
        Write-Host "✅ 所有服务启动完成" -ForegroundColor Green
        Write-Host "⏳ 等待数据库就绪（5秒）..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        Write-Host "📊 服务状态:" -ForegroundColor Cyan
        docker-compose -f $DockerComposeFile ps
        
        Write-Host "`n🌐 Mongo Express: http://localhost:8081" -ForegroundColor White
        Write-Host "🔑 用户名: admin, 密码: express" -ForegroundColor White
        
        Test-DbConnection
    }
    
    "stop-all" {
        Show-Header
        Write-Host "🛑 停止所有数据库服务..." -ForegroundColor Yellow
        docker-compose -f $DockerComposeFile down
        Write-Host "✅ 所有服务已停止" -ForegroundColor Green
    }

    default {
        Show-Header
        Write-Host "使用方法: .\db-manage.ps1 [命令]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "数据库管理命令:" -ForegroundColor Green
        Write-Host "  start         启动MongoDB数据库" -ForegroundColor White
        Write-Host "  stop          停止MongoDB数据库" -ForegroundColor White
        Write-Host "  status        查看MongoDB状态" -ForegroundColor White
        Write-Host "  logs          查看MongoDB日志" -ForegroundColor White
        Write-Host "  shell         进入MongoDB Shell (admin)" -ForegroundColor White
        Write-Host "  app-shell     进入应用数据库Shell" -ForegroundColor White
        Write-Host "  reset         重置数据库（删除数据）" -ForegroundColor White
        Write-Host "  backup        备份数据库" -ForegroundColor White
        Write-Host "  restore       恢复数据库" -ForegroundColor White
        Write-Host "  test          测试连接" -ForegroundColor White
        Write-Host "  info          显示连接信息" -ForegroundColor White
        Write-Host "  migrate       运行数据库迁移" -ForegroundColor White
        Write-Host "  seed          运行数据库种子数据" -ForegroundColor White
        Write-Host ""
        Write-Host "Mongo Express命令:" -ForegroundColor Cyan
        Write-Host "  express:start  启动Mongo Express Web界面" -ForegroundColor White
        Write-Host "  express:stop   停止Mongo Express" -ForegroundColor White
        Write-Host "  express:logs   查看Mongo Express日志" -ForegroundColor White
        Write-Host "  express:status 查看Mongo Express状态" -ForegroundColor White
        Write-Host "  express:open   在浏览器中打开Mongo Express" -ForegroundColor White
        Write-Host ""
        Write-Host "组合命令:" -ForegroundColor Magenta
        Write-Host "  start-all      启动所有服务 (MongoDB + Mongo Express)" -ForegroundColor White
        Write-Host "  stop-all       停止所有服务" -ForegroundColor White
        Write-Host ""
        Write-Host "示例:" -ForegroundColor Gray
        Write-Host "  .\db-manage.ps1 start             # 启动数据库并测试连接" -ForegroundColor DarkGray
        Write-Host "  .\db-manage.ps1 start-all         # 启动所有数据库服务" -ForegroundColor DarkGray
        Write-Host "  .\db-manage.ps1 express:start     # 启动Mongo Express" -ForegroundColor DarkGray
        Write-Host "  .\db-manage.ps1 express:open      # 打开Mongo Express界面" -ForegroundColor DarkGray
    }
}