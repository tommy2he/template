# cspell:disable
# 以管理员身份运行

# 1. 停止所有Docker相关服务
Stop-Service -Name com.docker.service -Force
Stop-Service -Name DockerDesktopService -Force

# 2. 删除Docker创建的DNS监听
$processes = Get-Process | Where-Object {$_.ProcessName -like "*docker*" -or $_.ProcessName -like "*vpnkit*"}
foreach ($proc in $processes) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

# 3. 重置网络适配器DNS
$adapters = Get-NetAdapter -Physical
foreach ($adapter in $adapters) {
    Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ResetServerAddresses
    Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses @("192.168.1.1", "114.114.114.114")
}

# 4. 清理所有DNS缓存
Clear-DnsClientCache
ipconfig /flushdns
nbtstat -R

# 5. 修改Hosts文件，移除Docker添加的条目
$hostsPath = "$env:windir\System32\drivers\etc\hosts"
$hostsContent = Get-Content $hostsPath | Where-Object { $_ -notlike "*docker*" -and $_ -notlike "*localhost*127.0.0.1" }
$hostsContent | Out-File $hostsPath -Encoding ASCII

# 6. 禁用Docker DNS服务
sc.exe config "com.docker.dns" start= disabled
sc.exe stop "com.docker.dns"

# 7. 创建注册表项阻止Docker修改DNS
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters"
New-ItemProperty -Path $regPath -Name "ServerPriorityTimeLimit" -Value 0 -PropertyType DWord -Force

Write-Host "修复完成！建议重启计算机。" -ForegroundColor Green