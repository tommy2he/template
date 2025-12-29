# 环境变量工具函数

function Get-ProjectRoot {
    # 尝试从环境变量获取
    $root = [Environment]::GetEnvironmentVariable("KOA_PROJECT_ROOT")
    if ($root -and (Test-Path $root)) {
        return $root
    }
    
    # 默认：基于脚本位置计算
    return Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}

function Import-EnvFile {
    param(
        [string]$ProjectRoot
    )
    
    $envFile = Join-Path $ProjectRoot ".env"
    $envVars = @{}
    
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        foreach ($line in $content) {
            $line = $line.Trim()
            if ($line -and -not $line.StartsWith('#')) {
                $parts = $line.Split('=', 2)
                if ($parts.Length -eq 2) {
                    $key = $parts[0].Trim()
                    $value = $parts[1].Trim()
                    
                    # 去除可能的引号
                    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                        $value = $value.Substring(1, $value.Length - 2)
                    } elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
                        $value = $value.Substring(1, $value.Length - 2)
                    }
                    
                    $envVars[$key] = $value
                    
                    # 设置到进程环境变量
                    [Environment]::SetEnvironmentVariable($key, $value, "Process")
                }
            }
        }
    }
    
    return $envVars
}

function Get-EnvValue {
    param(
        [string]$Key,
        [string]$DefaultValue,
        [hashtable]$EnvVars
    )
    
    # 1. 检查进程环境变量
    $value = [Environment]::GetEnvironmentVariable($Key, "Process")
    if ($value) { return $value }
    
    # 2. 检查用户环境变量
    $value = [Environment]::GetEnvironmentVariable($Key, "User")
    if ($value) { return $value }
    
    # 3. 检查系统环境变量
    $value = [Environment]::GetEnvironmentVariable($Key, "Machine")
    if ($value) { return $value }
    
    # 4. 检查传入的EnvVars
    if ($EnvVars.ContainsKey($Key)) {
        return $EnvVars[$Key]
    }
    
    # 5. 返回默认值
    return $DefaultValue
}

function Resolve-PathWithRoot {
    param(
        [string]$Path,
        [string]$ProjectRoot
    )
    
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    } else {
        return Join-Path $ProjectRoot $Path
    }
}

# 导出函数
Export-ModuleMember -Function Get-ProjectRoot, Import-EnvFile, Get-EnvValue, Resolve-PathWithRoot