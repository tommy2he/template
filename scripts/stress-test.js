#!/usr/bin/env node

const loadtest = require('loadtest');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);

class StressTest {
  constructor(options = {}) {
    this.port = options.port || 3003;
    this.server = null;
    this.results = [];
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('🚀 启动压力测试服务器...');

      this.server = spawn('node', [path.join(__dirname, '../dist/index.js')], {
        env: {
          ...process.env,
          PORT: this.port,
          NODE_ENV: 'production',
          LOG_LEVEL: 'error',
          ENABLE_SWAGGER: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          this.server.kill();
          reject(new Error('服务器启动超时'));
        }
      }, 10000);

      this.server.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('启动成功')) {
          clearTimeout(timeout);
          started = true;
          console.log('✅ 压力测试服务器已启动');
          setTimeout(resolve, 1000);
        }
      });

      this.server.stderr.on('data', (data) => {
        console.error('服务器错误:', data.toString());
      });

      this.server.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async stopServer() {
    if (this.server) {
      console.log('🛑 停止压力测试服务器...');
      this.server.kill();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async runLoadTest(config) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const options = {
        url: `http://localhost:${this.port}${config.path || ''}`,
        maxRequests: config.maxRequests,
        concurrency: config.concurrency,
        method: config.method || 'GET',
        timeout: config.timeout || 60000,
        statusCallback: (error, result, latency) => {
          if (error) {
            console.log(`❌ 请求错误: ${error}`);
          }
        },
        ...config,
      };

      console.log(`\n🧪 ${config.name}`);
      console.log(
        `   📊 配置: ${config.concurrency} 并发, ${config.maxRequests} 请求`,
      );

      loadtest.loadTest(options, (error, result) => {
        const elapsed = Date.now() - startTime;

        if (error) {
          console.error(`   ❌ 测试失败: ${error.message}`);
          reject(error);
        } else {
          console.log(`   ✅ 完成: ${result.totalRequests} 请求`);
          console.log(`   ⏱️  耗时: ${(elapsed / 1000).toFixed(2)} 秒`);
          console.log(`   📈 平均延迟: ${result.meanLatencyMs.toFixed(2)}ms`);
          console.log(`   ⚡ 请求/秒: ${result.rps.toFixed(2)}`);
          console.log(`   🔴 错误率: ${result.errorPercent.toFixed(2)}%`);

          resolve({
            name: config.name,
            ...result,
            elapsedTime: elapsed,
          });
        }
      });
    });
  }

  async runStressTests() {
    try {
      await this.startServer();

      console.log('\n' + '='.repeat(50));
      console.log('🔥 Koa Template App 压力测试');
      console.log('='.repeat(50));

      const tests = [
        {
          name: '轻负载测试',
          path: '/api/health',
          maxRequests: 1000,
          concurrency: 50,
          method: 'GET',
        },
        {
          name: '中等负载测试',
          path: '/api/health',
          maxRequests: 5000,
          concurrency: 100,
          method: 'GET',
        },
        {
          name: '高负载测试',
          path: '/api/health',
          maxRequests: 10000,
          concurrency: 200,
          method: 'GET',
        },
        {
          name: '静态文件压力测试',
          path: '/index.html',
          maxRequests: 5000,
          concurrency: 100,
          method: 'GET',
        },
        {
          name: 'API混合测试',
          path: '/api',
          maxRequests: 3000,
          concurrency: 150,
          method: 'GET',
        },
        {
          name: '极端并发测试',
          path: '/api/health',
          maxRequests: 15000,
          concurrency: 300,
          method: 'GET',
          timeout: 120000,
        },
      ];

      for (const test of tests) {
        try {
          const result = await this.runLoadTest(test);
          this.results.push(result);

          // 每个测试之间休息一下
          if (test !== tests[tests.length - 1]) {
            console.log('   💤 休息 3 秒...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (error) {
          console.error(`   ❌ 跳过此测试`);
        }
      }

      await this.generateReport();
    } catch (error) {
      console.error('❌ 压力测试失败:', error.message);
    } finally {
      await this.stopServer();
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 压力测试报告');
    console.log('='.repeat(50));

    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      totalTime: 0,
      maxRPS: 0,
      minLatency: Infinity,
      maxLatency: 0,
    };

    this.results.forEach((result) => {
      summary.totalRequests += result.totalRequests;
      summary.totalErrors += result.totalErrors;
      summary.totalTime += result.elapsedTime;
      summary.maxRPS = Math.max(summary.maxRPS, result.rps);
      summary.minLatency = Math.min(summary.minLatency, result.meanLatencyMs);
      summary.maxLatency = Math.max(summary.maxLatency, result.meanLatencyMs);
    });

    console.log(`📈 总请求数: ${summary.totalRequests.toLocaleString()}`);
    console.log(`⚠️  总错误数: ${summary.totalErrors}`);
    console.log(`⏱️  总耗时: ${(summary.totalTime / 1000).toFixed(2)} 秒`);
    console.log(`⚡ 最高请求/秒: ${summary.maxRPS.toFixed(2)}`);
    console.log(`📉 最低延迟: ${summary.minLatency.toFixed(2)}ms`);
    console.log(`📈 最高延迟: ${summary.maxLatency.toFixed(2)}ms`);

    // 生成HTML报告
    const report = `
<!DOCTYPE html>
<html>
<head>
    <title>Koa Template App - 压力测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #d9534f; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #dee2e6; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; border: 1px solid #dee2e6; text-align: left; }
        th { background: #e9ecef; }
        .good { color: #28a745; }
        .warning { color: #ffc107; }
        .bad { color: #dc3545; }
        .chart { margin: 30px 0; padding: 20px; background: white; border: 1px solid #dee2e6; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Koa Template App 压力测试报告</h1>
        <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <h2>📊 测试摘要</h2>
        <div class="metric">总请求数: <strong>${summary.totalRequests.toLocaleString()}</strong></div>
        <div class="metric">总错误数: <strong>${summary.totalErrors}</strong></div>
        <div class="metric">总耗时: <strong>${(summary.totalTime / 1000).toFixed(2)} 秒</strong></div>
        <div class="metric">最高RPS: <strong>${summary.maxRPS.toFixed(2)}</strong></div>
    </div>
    
    <h2>🔥 测试结果</h2>
    <table>
        <thead>
            <tr>
                <th>测试场景</th>
                <th>请求数</th>
                <th>并发数</th>
                <th>平均延迟</th>
                <th>请求/秒</th>
                <th>错误率</th>
                <th>耗时</th>
            </tr>
        </thead>
        <tbody>
            ${this.results
              .map(
                (r) => `
            <tr>
                <td>${r.name}</td>
                <td>${r.totalRequests.toLocaleString()}</td>
                <td>${r.concurrency}</td>
                <td class="${r.meanLatencyMs < 100 ? 'good' : r.meanLatencyMs < 500 ? 'warning' : 'bad'}">
                    ${r.meanLatencyMs.toFixed(2)}ms
                </td>
                <td>${r.rps.toFixed(2)}</td>
                <td class="${r.errorPercent === 0 ? 'good' : r.errorPercent < 1 ? 'warning' : 'bad'}">
                    ${r.errorPercent.toFixed(2)}%
                </td>
                <td>${(r.elapsedTime / 1000).toFixed(2)}秒</td>
            </tr>
            `,
              )
              .join('')}
        </tbody>
    </table>
    
    <div class="chart">
        <h3>📈 性能指标</h3>
        <p>延迟分析:</p>
        <ul>
            <li><span class="good">绿色 (&lt; 100ms)</span>: 优秀性能</li>
            <li><span class="warning">黄色 (100-500ms)</span>: 可接受性能</li>
            <li><span class="bad">红色 (&gt; 500ms)</span>: 需要优化</li>
        </ul>
        
        <p>错误率分析:</p>
        <ul>
            <li><span class="good">绿色 (0%)</span>: 完美</li>
            <li><span class="warning">黄色 (&lt; 1%)</span>: 可接受</li>
            <li><span class="bad">红色 (&gt;= 1%)</span>: 需要关注</li>
        </ul>
    </div>
    
    <div style="margin-top: 30px; color: #666; font-size: 0.9em;">
        <h3>💡 建议</h3>
        ${
          summary.maxLatency > 500
            ? '<p>⚠️ <strong>警告</strong>: 检测到高延迟，建议优化中间件顺序、添加缓存或升级服务器配置。</p>'
            : '<p>✅ <strong>良好</strong>: 应用性能表现优秀。</p>'
        }
        
        ${
          summary.totalErrors > 0
            ? '<p>⚠️ <strong>警告</strong>: 存在错误请求，建议检查错误日志并修复。</p>'
            : '<p>✅ <strong>良好</strong>: 零错误率，应用稳定性良好。</p>'
        }
    </div>
</body>
</html>`;

    const reportPath = path.join(__dirname, '../stress-report.html');
    await writeFile(reportPath, report);
    console.log(`\n📄 压力测试报告已生成: file://${reportPath}`);
  }
}

// 运行压力测试
if (require.main === module) {
  const stressTest = new StressTest();
  stressTest.runStressTests().catch(console.error);
}

module.exports = StressTest;
