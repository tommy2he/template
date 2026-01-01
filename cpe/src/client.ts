/* eslint-disable no-console */
import { CPEClient } from './cpe-client';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env.cpe') });

const cpeConfig = {
  // 基本配置
  deviceId: process.env.CPE_DEVICE_ID || 'dev-cpe-001',
  cpeId: process.env.CPE_ID || 'cpe-001',
  manufacturer: process.env.CPE_MANUFACTURER || 'TP-Link',
  model: process.env.CPE_MODEL || 'Archer C7',

  // 服务器配置
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  wsUrl: process.env.WS_URL || 'ws://localhost:7547',

  // 心跳配置
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30'),

  // 能力配置
  capabilities: (process.env.CPE_CAPABILITIES || 'wifi,lan,wan,dhcp').split(
    ',',
  ),

  // 模拟配置
  simulateMetrics: process.env.SIMULATE_METRICS !== 'false',
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60'),
};

async function main() {
  console.log('🚀 启动模拟CPE客户端');
  console.log('='.repeat(50));
  console.log(`📱 CPE ID: ${cpeConfig.cpeId}`);
  console.log(`🔗 服务器: ${cpeConfig.serverUrl}`);
  console.log(`💓 心跳间隔: ${cpeConfig.heartbeatInterval}秒`);
  console.log(`🔧 设备能力: ${cpeConfig.capabilities.join(', ')}`);
  console.log('='.repeat(50));

  try {
    // 创建CPE客户端
    const cpeClient = new CPEClient(cpeConfig);

    // 注册到服务器
    await cpeClient.register();

    // 启动心跳
    cpeClient.startHeartbeat();

    // 启动WebSocket连接
    await cpeClient.connectWebSocket();

    // 启动指标模拟（如果启用）
    if (cpeConfig.simulateMetrics) {
      cpeClient.startMetricsSimulation();
    }

    console.log('\n✅ CPE客户端启动成功');
    console.log('📡 状态: 已注册并连接');

    // 处理关闭信号
    process.on('SIGINT', async () => {
      console.log('\n🛑 收到关闭信号，正在清理...');
      await cpeClient.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 收到终止信号，正在清理...');
      await cpeClient.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ CPE客户端启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export { CPEClient };
