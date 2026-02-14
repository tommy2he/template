#!/usr/bin/env node
// cpe/scripts/batch-generator.js - 批量生成CPE实例
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const args = process.argv.slice(2);
const count = parseInt(args[0]) || 3;
const startPort = parseInt(args[1]) || 8000;

console.log(`🚀 批量生成 ${count} 个CPE实例，起始端口: ${startPort}`);

const instances = [];

for (let i = 0; i < count; i++) {
  const port = startPort + i;
  const cpeId = `cpe-batch-${port}`;

  console.log(`\n📱 启动实例 ${i + 1}: ${cpeId}, 端口: ${port}`);

  const env = {
    ...process.env,
    CPE_UDP_PORT: port.toString(),
    CPE_ID: cpeId,
    CPE_DEVICE_ID: `dev-${cpeId}`,
  };

  const child = spawn('npx', ['ts-node', 'cpe/src/client.ts', 'mode=2'], {
    env,
    stdio: 'pipe',
    shell: true,
    cwd: path.join(__dirname, '..', '..'),
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) console.log(`[${cpeId}] ${line}`);
    });
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
  console.log('\n🛑 收到关闭信号，停止所有实例...');
  instances.forEach((child) => child.kill('SIGINT'));
  setTimeout(() => process.exit(0), 1000);
});

console.log('\n✅ 所有CPE实例已启动');
console.log('📌 按 Ctrl+C 停止所有实例');
