#!/usr/bin/env node

const loadtest = require('loadtest');
const { spawn } = require('child_process');
const path = require('path');

class StressTest {
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

      setTimeout(resolve, 2000);
    });
  }

  async stopServer() {
    if (this.server) {
      this.server.kill();
    }
  }

  async runLoadTest(options) {
    return new Promise((resolve, reject) => {
      const opts = {
        url: `http://localhost:${this.port}${options.path || ''}`,
        maxRequests: options.maxRequests || 10000,
        concurrency: options.concurrency || 100,
        method: options.method || 'GET',
        statusCallback: this.statusCallback,
        ...options,
      };

      loadtest.loadTest(opts, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }

  statusCallback(latency, result, error) {
    if (error) {
      console.error(`❌ 请求错误: ${error}`);
    }
  }

  async runStressTests() {
    try {
      await this.startServer();

      console.log('🔥 开始压力测试\n');

      const tests = [
        {
          name: '轻负载测试',
          maxRequests: 1000,
          concurrency: 50,
          path: '/api/health',
        },
        {
          name: '中等负载测试',
          maxRequests: 5000,
          concurrency: 200,
          path: '/api/health',
        },
        {
          name: '重负载测试',
          maxRequests: 10000,
          concurrency: 500,
          path: '/api',
        },
        {
          name: '混合请求测试',
          maxRequests: 8000,
          concurrency: 300,
          requestsPerSecond: 100,
          path: '/api',
        },
      ];

      for (const test of tests) {
        console.log(`\n🧪 ${test.name}...`);
        const startTime = Date.now();

        try {
          const results = await this.runLoadTest(test);
          const duration = (Date.now() - startTime) / 1000;

          console.log(`   ✅ 完成: ${results.totalRequests} 请求`);
          console.log(`   ⏱️  耗时: ${duration.toFixed(2)} 秒`);
          console.log(`   📊 平均延迟: ${results.meanLatencyMs.toFixed(2)}ms`);
          console.log(`   ⚡ 请求/秒: ${results.rps.toFixed(2)}`);
          console.log(`   🔴 错误率: ${results.errorPercent.toFixed(2)}%`);
        } catch (error) {
          console.error(`   ❌ 测试失败: ${error.message}`);
        }
      }
    } finally {
      await this.stopServer();
    }
  }
}

// 运行压力测试
if (require.main === module) {
  const stressTest = new StressTest(3003);
  stressTest.runStressTests().catch(console.error);
}

module.exports = StressTest;
