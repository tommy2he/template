REM cspell:disable
:: 1. 检查谁在监听DNS端口（53端口）
netstat -ano | findstr ":53"

:: 2. 强制使用公共DNS
netsh interface ip set dns name="以太网" source=static addr=114.114.114.114

:: 3. 停止Docker的DNS服务
net stop com.docker.service

:: 4. 测试是否有DNS劫持
nslookup docker.internal
:: 如果返回成功，说明Docker DNS正在运行