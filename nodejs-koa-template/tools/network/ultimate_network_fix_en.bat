REM cspell:disable
@echo off
echo ===== Ultimate Network Fix for Docker Issues =====
echo Administrator privileges required...
echo.

:: Verify admin rights
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if %errorlevel% neq 0 (
    echo ERROR: Please run as Administrator!
    pause
    exit /b 1
)

echo [1] STOPPING all Docker services...
net stop com.docker.service >nul 2>&1
taskkill /f /im Docker* >nul 2>&1
taskkill /f /im "vpnkit*" >nul 2>&1

echo [2] RESETTING network stack...
netsh winsock reset >nul
netsh int ip reset >nul
netsh int ipv6 reset >nul

echo [3] CLEARING all caches...
ipconfig /flushdns >nul
ipconfig /release >nul
arp -d * >nul
nbtstat -R >nul

echo [4] FIXING DNS (use router + backup)...
netsh interface ip set dns name="Ethernet" source=dhcp
netsh interface ip add dns name="Ethernet" addr=114.114.114.114 index=2

echo [5] RESETTING routing table...
route -f
echo Waiting 5 seconds for route recovery...
timeout /t 5 /nobreak >nul

echo [6] RENEWING IP address...
ipconfig /renew >nul

echo [7] ADJUSTING MTU (prevent fragmentation)...
netsh interface ipv4 set subinterface "Ethernet" mtu=1450 store=persistent

echo [8] RESTARTING network services...
net stop dnscache >nul 2>&1
net stop Dhcp >nul 2>&1
timeout /t 3 /nobreak >nul
net start dnscache >nul
net start Dhcp >nul

echo [9] TESTING connection...
echo Testing router connectivity...
ping -n 2 192.168.1.1 >nul
if %errorlevel% equ 0 (
    echo ✓ Router: OK
) else (
    echo ✗ Router: FAILED
)

echo Testing DNS resolution...
nslookup baidu.com >nul
if %errorlevel% equ 0 (
    echo ✓ DNS: OK
) else (
    echo ✗ DNS: FAILED
)

echo Testing internet access...
ping -n 2 8.8.8.8 >nul
if %errorlevel% equ 0 (
    echo ✓ Internet: OK
) else (
    echo ✗ Internet: FAILED
)

echo.
echo [10] FINAL recommendations:
echo.
echo If still having issues:
echo 1. Restart your computer
echo 2. Restart your router
echo 3. Check Docker Desktop settings:
echo    - Disable "Enable DNS" in Network settings
echo    - Use WSL 2 backend if available
echo.
echo ===== FIX COMPLETE =====
echo Network should be restored. If not, try restart.
pause