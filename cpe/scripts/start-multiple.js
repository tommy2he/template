#!/usr/bin/env node
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require('child_process');
// const path = require('path');

const count = parseInt(process.argv[2]) || 1;
const instances = [];

console.log(`🚀 启动 ${count} 个CPE实例`);

// 在循环中添加不同端口
for (let i = 1; i <= count; i++) {
  const cpeId = `cpe-${i.toString().padStart(3, '0')}`;
  const deviceId = `dev-cpe-${i.toString().padStart(3, '0')}`;
  const udpPort = 7548 + i; // 每个实例使用不同端口

  console.log(`\n📱 启动实例 ${i}: ${cpeId}, UDP端口: ${udpPort}`);

  const env = {
    ...process.env,
    CPE_ID: cpeId,
    CPE_DEVICE_ID: deviceId,
    CPE_MANUFACTURER: i % 2 === 0 ? 'TP-Link' : 'Cisco',
    CPE_MODEL: i % 2 === 0 ? 'Archer C7' : 'ISR 4000',
    CPE_UDP_PORT: udpPort.toString(), // 设置不同的UDP端口
    PORT: 3000 + i,
  };

  const child = spawn('node', ['cpe/src/client.ts'], {
    env,
    stdio: 'pipe',
    shell: true,
  });

  child.stdout.on('data', (data) => {
    console.log(`[${cpeId}] ${data.toString().trim()}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`[${cpeId} ERROR] ${data.toString().trim()}`);
  });

  child.on('close', (code) => {
    console.log(`[${cpeId}] 进程退出，代码: ${code}`);
  });

  instances.push(child);
}

// 处理退出信号
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，停止所有CPE实例...');
  instances.forEach((child) => child.kill('SIGINT'));
  process.exit(0);
});

console.log('\n✅ 所有CPE实例已启动');
console.log('📌 按 Ctrl+C 停止所有实例');
