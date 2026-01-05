REM cspell:disable
REM used in cmd
@echo off
echo ===== DNS劫持检测工具 =====
echo.

echo [1] 当前DNS服务器：
ipconfig /all | findstr /C:"DNS 服务器"

echo.
echo [2] 检查53端口监听：
echo 运行以下命令查看谁在监听DNS端口：
echo netstat -ano | findstr ":53"
echo.

echo [3] 测试Docker DNS：
nslookup docker.internal
if %errorlevel% equ 0 (
    echo ??  检测到Docker DNS劫持！
) else (
    echo ? 未检测到Docker DNS劫持
)

echo.
echo [4] 测试公共DNS解析：
echo 尝试解析 baidu.com...
nslookup baidu.com 8.8.8.8 >nul
if %errorlevel% equ 0 (
    echo ? 公共DNS解析正常
) else (
    echo ? 公共DNS解析失败
)

echo.
echo [5] 测试当前DNS解析：
echo 尝试解析 baidu.com...
nslookup baidu.com >nul
if %errorlevel% equ 0 (
    echo ? 当前DNS解析正常
) else (
    echo ? 当前DNS解析失败
)

pause