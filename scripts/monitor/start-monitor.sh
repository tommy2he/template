#!/bin/bash
# scripts/monitor/start-monitor.sh - 修改后的版本

echo "启动监控系统..."
echo "================================"

# 确保从项目根目录运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT" || exit

echo "项目根目录: $PROJECT_ROOT"

# 创建必要的目录
mkdir -p docker/monitor/grafana/provisioning/dashboards

# 检查是否已经安装Docker
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

# 启动监控服务
cd docker/monitor
docker-compose up -d

echo ""
echo "✅ 监控系统启动成功！"
echo ""
echo "访问地址："
echo "  Grafana仪表板: http://localhost:3000"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "  Prometheus: http://localhost:9090"
echo "  Alertmanager: http://localhost:9093"
echo ""
echo "需要先确保你的Koa应用已启动在: http://localhost:7547"
echo "应用指标端点: http://localhost:7547/metrics"