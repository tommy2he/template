REM cspell:disable
@echo off
echo ===== Docker DNS Hijack Fix =====
echo Running as Administrator...
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script requires Administrator privileges!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [1] Stopping Docker services...
net stop com.docker.service >nul 2>&1
taskkill /f /im "Docker Desktop.exe" >nul 2>&1

echo [2] Backing up current DNS settings...
ipconfig /all > "%userprofile%\Desktop\dns_backup_%date:~4,2%%date:~7,2%%date:~10,4%.txt"

echo [3] Clearing DNS cache...
ipconfig /flushdns >nul
nbtstat -R >nul
nbtstat -RR >nul

echo [4] Resetting DNS to public servers...
netsh interface ip set dns name="Ethernet" source=static addr=114.114.114.114 primary
netsh interface ip add dns name="Ethernet" addr=8.8.8.8 index=2
netsh interface ip add dns name="Ethernet" addr=192.168.1.1 index=3

echo [5] Clearing ARP cache...
arp -d *

echo [6] Releasing and renewing IP...
ipconfig /release >nul
timeout /t 5 /nobreak >nul
ipconfig /renew >nul

echo [7] Verifying DNS settings...
echo.
echo Current DNS servers:
netsh interface ip show dns name="Ethernet"

echo.
echo [8] Testing DNS resolution...
nslookup baidu.com
if %errorlevel% equ 0 (
    echo OK: DNS resolution works
) else (
    echo ERROR: DNS resolution fails
)

echo.
echo [9] Testing internet connectivity...
ping -n 2 8.8.8.8 >nul
if %errorlevel% equ 0 (
    echo OK: Internet connectivity restored
) else (
    echo ERROR: Still no internet access
)

echo.
echo ===== Fix Complete =====
echo If problem persists, you may need to:
echo 1. Restart your router
echo 2. Restart your computer
echo 3. Reinstall Docker Desktop
pause