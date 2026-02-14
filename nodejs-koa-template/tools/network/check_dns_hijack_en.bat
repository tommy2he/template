REM cspell:disable
@echo off
echo ===== DNS Hijack Detection Tool =====
echo.

echo [1] Current DNS Servers:
ipconfig /all | findstr /C:"DNS Servers"

echo.
echo [2] Checking port 53 listeners:
netstat -ano | findstr ":53"
echo.

echo [3] Testing Docker DNS:
nslookup docker.internal
if %errorlevel% equ 0 (
    echo WARNING: Docker DNS hijack detected!
) else (
    echo OK: No Docker DNS hijack
)

echo.
echo [4] Testing public DNS resolution:
echo Testing baidu.com with 8.8.8.8...
nslookup baidu.com 8.8.8.8 >nul
if %errorlevel% equ 0 (
    echo OK: Public DNS resolution works
) else (
    echo ERROR: Public DNS resolution fails
)

echo.
echo [5] Testing current DNS resolution:
echo Testing baidu.com with current DNS...
nslookup baidu.com >nul
if %errorlevel% equ 0 (
    echo OK: Current DNS resolution works
) else (
    echo ERROR: Current DNS resolution fails
)

echo.
echo [6] Testing network connectivity:
ping -n 2 192.168.1.1 >nul
if %errorlevel% equ 0 (
    echo OK: Router reachable
) else (
    echo ERROR: Router not reachable
)

ping -n 2 8.8.8.8 >nul
if %errorlevel% equ 0 (
    echo OK: Internet reachable
) else (
    echo ERROR: Internet not reachable
)

echo.
echo ===== Test Complete =====
pause