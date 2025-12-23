#!/usr/bin/env node

const autocannon = require('autocannon');
const { spawn } = require('child_process');
const path = require('path');

class Benchmark {
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
  }

  async startServer() {
    return new Promise((resolve) => {
      this.server = spawn('node', [path.join(__dirname, '../dist/index.js')], {
        env: { ...process.env, PORT: this.port, NODE_ENV: 'production' },
        stdio: 'inherit',
      });

      // 等待服务器启动
      setTimeout(resolve, 2000);
    });
  }

  async stopServer() {
    if (this.server) {
      this.server.kill();
    }
  }

  async runBenchmark(options = {}) {
    const defaults = {
      url: `http://localhost:${this.port}`,
      connections: 100,
      duration: 10,
      pipelining: 1,
      title: 'Koa Template App Benchmark',
    };

    const config = { ...defaults, ...options };

    console.log(`🚀 开始性能测试: ${config.title}`);
    console.log(`📊 配置: ${config.connections} 连接, ${config.duration} 秒`);

    const result = await autocannon(config);

    console.log('\n📈 测试结果:');
    console.log(`✅ 平均延迟: ${result.latency.average}ms`);
    console.log(`📤 吞吐量: ${result.throughput.average} 请求/秒`);
    console.log(`🔴 错误率: ${result.errors}%`);
    console.log(`📉 请求/秒: ${result.requests.average}`);

    return result;
  }

  async runAllTests() {
    try {
      await this.startServer();

      console.log('🏁 开始综合性能测试套件\n');

      // 测试1: 基础API性能
      console.log('1️⃣ 测试基础API性能...');
      await this.runBenchmark({
        title: '基础API测试',
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api' },
          { method: 'GET', path: '/api/health' },
        ],
      });

      // 测试2: 并发性能
      console.log('\n2️⃣ 测试高并发性能...');
      await this.runBenchmark({
        title: '高并发测试',
        connections: 500,
        duration: 15,
        requests: [{ method: 'GET', path: '/api/health' }],
      });

      // 测试3: 速率限制测试
      console.log('\n3️⃣ 测试速率限制...');
      await this.runBenchmark({
        title: '速率限制测试',
        connections: 50,
        duration: 30,
        requests: [{ method: 'GET', path: '/api/rate-limit-test' }],
      });
    } finally {
      await this.stopServer();
    }
  }
}

// 运行基准测试
if (require.main === module) {
  const benchmark = new Benchmark(3002);
  benchmark.runAllTests().catch(console.error);
}

module.exports = Benchmark;
