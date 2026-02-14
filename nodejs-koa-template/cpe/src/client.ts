/* eslint-disable no-console */
// cpe/src/client.ts - 支持命令行参数的新版本
import { CPEClient } from './cpe-client';
import dotenv from 'dotenv';
import path from 'path';
import { parseCLIArgs, generateCPEConfig } from './cli-parser';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env.cpe') });

async function main() {
  console.log('🚀 启动模拟CPE客户端 (支持参数化启动)');
  console.log('='.repeat(50));

  try {
    // 1. 解析命令行参数
    const args = parseCLIArgs();

    // 2. 根据参数生成配置
    const config = generateCPEConfig(args);

    console.log('📋 生成的CPE配置:');
    console.log(`   CPE ID: ${config.cpeId}`);
    console.log(`   设备ID: ${config.deviceId}`);
    console.log(`   厂商: ${config.manufacturer}`);
    console.log(`   型号: ${config.model}`);
    console.log(`   UDP端口: ${config.cpeUdpPort}`);
    console.log(`   IP地址: ${config.cpeIp}`);
    console.log('='.repeat(50));

    // 3. 创建CPE客户端配置
    const cpeConfig = {
      // 基本配置
      deviceId: config.deviceId,
      cpeId: config.cpeId,
      manufacturer: config.manufacturer,
      model: config.model,

      // ACS服务器配置
      acsUrl: process.env.ACS_WS_URL || 'ws://localhost:7547',
      acsHost: process.env.ACS_HOST || 'localhost',

      // CPE本地配置
      cpeUdpPort: config.cpeUdpPort,
      cpeIp: config.cpeIp,

      // 心跳配置 - 从环境变量读取
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '1800'),

      // 新增：空闲超时配置
      inactivityTimeout: parseInt(
        process.env.CPE_INACTIVITY_TIMEOUT || '30000',
      ),

      // 能力配置
      capabilities: (process.env.CPE_CAPABILITIES || 'wifi,lan,wan,dhcp').split(
        ',',
      ),

      // 模拟配置
      simulateMetrics: process.env.SIMULATE_METRICS !== 'false',

      // 重连配置
      reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '5000'),
      maxReconnectAttempts: parseInt(
        process.env.MAX_RECONNECT_ATTEMPTS || '10',
      ),
    };

    console.log('⚙️  高级配置:');
    console.log(`   心跳间隔: ${cpeConfig.heartbeatInterval}秒`);
    console.log(`   空闲超时: ${cpeConfig.inactivityTimeout}ms`);
    console.log(`   重连间隔: ${cpeConfig.reconnectInterval}ms`);
    console.log('='.repeat(50));

    // 4. 创建并启动CPE客户端
    const cpeClient = new CPEClient(cpeConfig);
    await cpeClient.start();

    // 5. 处理关闭信号
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
