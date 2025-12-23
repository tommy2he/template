#!/usr/bin/env node

const autocannon = require('autocannon');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists);

class Benchmark {
  constructor(options = {}) {
    this.port = options.port || 3002;
    this.server = null;
    this.results = [];
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('🚀 启动测试服务器...');

      // 构建项目
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'inherit',
      });

      buildProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`构建失败，退出码: ${code}`));
          return;
        }

        // 启动服务器
        this.server = spawn(
          'node',
          [path.join(__dirname, '../dist/index.js')],
          {
            env: {
              ...process.env,
              PORT: this.port,
              NODE_ENV: 'production',
              LOG_LEVEL: 'error', // 性能测试时减少日志
              ENABLE_SWAGGER: 'false',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );

        let started = false;
        const timeout = setTimeout(() => {
          if (!started) {
            this.server.kill();
            reject(new Error('服务器启动超时'));
          }
        }, 10000);

        // 监听服务器输出
        this.server.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('启动成功')) {
            clearTimeout(timeout);
            started = true;
            console.log('✅ 测试服务器已启动');
            setTimeout(resolve, 1000); // 给服务器一点时间
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
    });
  }

  async stopServer() {
    if (this.server) {
      console.log('🛑 停止测试服务器...');
      this.server.kill();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async runSingleBenchmark(config) {
    console.log(`\n🧪 ${config.title}`);
    console.log(
      `   📊 配置: ${config.connections} 连接, ${config.duration} 秒`,
    );

    const startTime = Date.now();
    const result = await autocannon(config);
    const elapsed = Date.now() - startTime;

    // 美化输出
    console.log(`   ✅ 完成: ${result.requests.total} 请求`);
    console.log(`   ⏱️  耗时: ${(elapsed / 1000).toFixed(2)} 秒`);
    console.log(`   📈 平均延迟: ${result.latency.average.toFixed(2)}ms`);
    console.log(`   ⚡ 请求/秒: ${result.requests.average.toFixed(2)}`);
    console.log(`   🔴 错误率: ${result.errors}%`);
    console.log(
      `   📤 吞吐量: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`,
    );

    return result;
  }

  async runComprehensiveBenchmark() {
    try {
      await this.startServer();

      const baseUrl = `http://localhost:${this.port}`;

      console.log('\n' + '='.repeat(50));
      console.log('🏁 Koa Template App 性能基准测试');
      console.log('='.repeat(50));

      // 测试1: 基础健康检查
      const healthResult = await this.runSingleBenchmark({
        url: `${baseUrl}/api/health`,
        connections: 10,
        duration: 10,
        title: '健康检查端点',
      });
      this.results.push({ name: '健康检查', ...healthResult });

      // 测试2: API端点
      const apiResult = await this.runSingleBenchmark({
        url: `${baseUrl}/api`,
        connections: 10,
        duration: 10,
        title: 'API根端点',
      });
      this.results.push({ name: 'API根端点', ...apiResult });

      // 测试3: 静态文件
      const staticResult = await this.runSingleBenchmark({
        url: `${baseUrl}/index.html`,
        connections: 10,
        duration: 10,
        title: '静态文件服务',
      });
      this.results.push({ name: '静态文件', ...staticResult });

      // 测试4: 中等并发
      const mediumConcurrency = await this.runSingleBenchmark({
        url: `${baseUrl}/api/health`,
        connections: 50,
        duration: 15,
        title: '中等并发 (50连接)',
      });
      this.results.push({ name: '中等并发', ...mediumConcurrency });

      // 测试5: 高并发
      const highConcurrency = await this.runSingleBenchmark({
        url: `${baseUrl}/api/health`,
        connections: 100,
        duration: 20,
        title: '高并发 (100连接)',
      });
      this.results.push({ name: '高并发', ...highConcurrency });

      // 测试6: 混合请求
      const mixedRequests = await this.runSingleBenchmark({
        url: baseUrl,
        connections: 30,
        duration: 15,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/index.html' },
        ],
        title: '混合请求测试',
      });
      this.results.push({ name: '混合请求', ...mixedRequests });

      // 生成报告
      await this.generateReport();
    } catch (error) {
      console.error('❌ 基准测试失败:', error.message);
    } finally {
      await this.stopServer();
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 性能测试报告');
    console.log('='.repeat(50));

    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      avgLatency: 0,
      avgThroughput: 0,
      avgRPS: 0,
    };

    this.results.forEach((result, index) => {
      summary.totalRequests += result.requests.total;
      summary.totalErrors += result.errors;
      summary.avgLatency += result.latency.average;
      summary.avgThroughput += result.throughput.average;
      summary.avgRPS += result.requests.average;
    });

    const count = this.results.length;
    summary.avgLatency /= count;
    summary.avgThroughput /= count;
    summary.avgRPS /= count;

    console.log(`📈 总请求数: ${summary.totalRequests.toLocaleString()}`);
    console.log(`⚠️  总错误数: ${summary.totalErrors}`);
    console.log(`⏱️  平均延迟: ${summary.avgLatency.toFixed(2)}ms`);
    console.log(`⚡ 平均请求/秒: ${summary.avgRPS.toFixed(2)}`);
    console.log(
      `📤 平均吞吐量: ${(summary.avgThroughput / 1024 / 1024).toFixed(2)} MB/秒`,
    );

    // 生成HTML报告
    const report = `
<!DOCTYPE html>
<html>
<head>
    <title>Koa Template App - 性能测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #4a6fa5; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #f0f0f0; }
        .good { color: green; }
        .warning { color: orange; }
        .bad { color: red; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Koa Template App 性能测试报告</h1>
        <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <h2>📊 测试摘要</h2>
        <p>总请求数: ${summary.totalRequests.toLocaleString()}</p>
        <p>总错误数: ${summary.totalErrors}</p>
        <p>平均延迟: ${summary.avgLatency.toFixed(2)}ms</p>
        <p>平均吞吐量: ${(summary.avgThroughput / 1024 / 1024).toFixed(2)} MB/秒</p>
    </div>
    
    <h2>📈 详细结果</h2>
    <table>
        <thead>
            <tr>
                <th>测试场景</th>
                <th>请求数</th>
                <th>平均延迟</th>
                <th>请求/秒</th>
                <th>错误率</th>
                <th>吞吐量</th>
            </tr>
        </thead>
        <tbody>
            ${this.results
              .map(
                (r) => `
            <tr>
                <td>${r.name}</td>
                <td>${r.requests.total.toLocaleString()}</td>
                <td class="${r.latency.average < 50 ? 'good' : r.latency.average < 200 ? 'warning' : 'bad'}">
                    ${r.latency.average.toFixed(2)}ms
                </td>
                <td>${r.requests.average.toFixed(2)}</td>
                <td class="${r.errors === 0 ? 'good' : 'bad'}">${r.errors}%</td>
                <td>${(r.throughput.total / 1024 / 1024).toFixed(2)} MB</td>
            </tr>
            `,
              )
              .join('')}
        </tbody>
    </table>
    
    <div style="margin-top: 30px; color: #666; font-size: 0.9em;">
        <p>性能评级:</p>
        <ul>
            <li><span class="good">绿色</span>: 延迟 &lt; 50ms (优秀)</li>
            <li><span class="warning">橙色</span>: 延迟 50-200ms (良好)</li>
            <li><span class="bad">红色</span>: 延迟 &gt; 200ms (需要优化)</li>
        </ul>
    </div>
</body>
</html>`;

    const reportPath = path.join(__dirname, '../performance-report.html');
    await writeFile(reportPath, report);
    console.log(`\n📄 详细报告已生成: file://${reportPath}`);
  }
}

// 运行基准测试
if (require.main === module) {
  const benchmark = new Benchmark();
  benchmark.runComprehensiveBenchmark().catch(console.error);
}

module.exports = Benchmark;
