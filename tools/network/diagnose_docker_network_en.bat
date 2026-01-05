REM cspell:disable
@echo off
echo ===== Docker Network Diagnostic =====
echo.

echo [1] Checking Docker processes:
tasklist | findstr /i docker
echo.

echo [2] Checking network adapters:
echo Ethernet adapters:
ipconfig | findstr /i ethernet
echo.
echo Virtual adapters:
ipconfig | findstr /i vEthernet
echo.

echo [3] Checking port 53 (DNS) listeners:
echo Processes listening on port 53 (DNS):
netstat -ano | findstr ":53"
echo.

echo [4] Checking routing table:
echo Default route:
route print | findstr "0.0.0.0"
echo.
echo Docker-related routes (172.x.x.x):
route print | findstr "172\."
echo.

echo [5] Checking DNS configuration:
echo DNS servers for each adapter:
for /f "tokens=1,2 delims=:" %%a in ('ipconfig /all ^| findstr /C:"DNS Servers"') do (
    echo %%a: %%b
)
echo.

echo [6] Testing different DNS servers:
echo Testing with Google DNS (8.8.8.8):
nslookup baidu.com 8.8.8.8
echo.
echo Testing with current DNS:
nslookup baidu.com
echo.

echo [7] Checking MTU settings:
echo Testing MTU to router (may show fragmentation needed):
ping -f -l 1472 192.168.1.1
echo.
echo Testing MTU to internet:
ping -f -l 1400 8.8.8.8
echo.

echo [8] Checking for Docker network conflicts:
echo Looking for Hyper-V network components:
powershell -Command "Get-NetAdapter | Where-Object {$_.Name -like '*Hyper*' -or $_.Name -like '*Docker*' -or $_.Name -like '*vEthernet*'}"
echo.

echo ===== Diagnostic Complete =====
echo.
echo Common issues found:
echo 1. If port 53 is used by non-DNS service = DNS conflict
echo 2. If multiple default routes = Routing conflict
echo 3. If MTU test fails = Need to adjust MTU
echo 4. If only IP works but not domain = DNS problem
pause