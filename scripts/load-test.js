#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readline = require('readline');

const writeFile = promisify(fs.writeFile);
const execAsync = promisify(exec);

class LoadTest {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.server = null;
    this.serverPid = null;
    this.results = [];
    this.baseUrl = `http://localhost:${this.port}`;
  }

  // 清理占用端口的进程
  async killPortProcess(port) {
    try {
      if (process.platform === 'win32') {
        const netstatCmd = `netstat -ano | findstr :${port} | findstr LISTENING`;
        try {
          const { stdout } = await execAsync(netstatCmd, { shell: true });
          if (stdout.trim()) {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && !isNaN(pid)) {
                console.log(`🔫 杀死占用端口 ${port} 的进程: ${pid}`);
                await execAsync(`taskkill /F /PID ${pid} /T`, { shell: true });
              }
            }
          }
        } catch (error) {
          // 没有找到进程是正常的
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`⚠️  清理端口时出错: ${error.message}`);
    }
  }

  async startServer() {
    console.log(`🚀 启动负载测试服务器 (端口: ${this.port})...`);

    // 清理可能占用端口的进程
    await this.killPortProcess(this.port);

    return new Promise((resolve, reject) => {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

      const buildProcess = spawn(npmCommand, ['run', 'build'], {
        stdio: 'inherit',
        shell: true,
      });

      buildProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`构建失败，退出码: ${code}`));
          return;
        }

        console.log('✅ 构建完成，启动服务器...');

        this.server = spawn(
          'node',
          [path.join(__dirname, '../dist/index.js')],
          {
            env: {
              ...process.env,
              PORT: this.port.toString(),
              NODE_ENV: 'production',
              LOG_LEVEL: 'error',
              ENABLE_SWAGGER: 'false',
              JWT_SECRET: 'benchmark_test_secret_key_change_in_production',
              RATE_LIMIT_ENABLED: 'false',
              RATE_LIMIT_WINDOW_MS: '0',
              RATE_LIMIT_MAX_REQUESTS: '999999',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
          },
        );

        this.serverPid = this.server.pid;
        console.log(`📝 服务器PID: ${this.serverPid}`);

        let started = false;
        const timeout = setTimeout(() => {
          if (!started) {
            this.server.kill();
            reject(new Error('服务器启动超时'));
          }
        }, 15000);

        this.server.stdout.on('data', (data) => {
          const output = data.toString();
          console.log('服务器输出:', output.trim());

          if (
            output.includes('启动成功') ||
            output.includes('地址:') ||
            output.includes('Server started') ||
            output.includes('listening on port')
          ) {
            clearTimeout(timeout);
            started = true;
            console.log(`✅ 负载测试服务器已启动在端口 ${this.port}`);
            setTimeout(resolve, 2000);
          }
        });

        this.server.stderr.on('data', (data) => {
          const errorOutput = data.toString();

          if (
            errorOutput.includes('EADDRINUSE') ||
            errorOutput.includes('address already in use')
          ) {
            console.error(`❌ 端口 ${this.port} 被占用，尝试其他端口...`);
            this.port += 1;
            if (this.port > 3012) {
              reject(new Error('找不到可用端口'));
            } else {
              this.server.kill();
              setTimeout(() => {
                this.startServer().then(resolve).catch(reject);
              }, 1000);
            }
            return;
          }

          console.error('服务器错误输出:', errorOutput.trim());
        });

        this.server.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      buildProcess.on('error', (error) => {
        reject(new Error(`构建失败: ${error.message}`));
      });
    });
  }

  async stopServer() {
    if (this.server) {
      console.log('🛑 停止负载测试服务器...');

      // 等待请求完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (process.platform === 'win32') {
        // Windows: 使用taskkill
        try {
          await execAsync(`taskkill /F /PID ${this.serverPid} /T`, {
            shell: true,
          });
          console.log('✅ 服务器已停止');
        } catch (error) {
          console.log(`⚠️  taskkill失败: ${error.message}`);
          this.server.kill('SIGKILL');
        }
      } else {
        // Linux/Mac: 先优雅关闭，再强制关闭
        this.server.kill('SIGTERM');
        const timeout = setTimeout(() => {
          this.server.kill('SIGKILL');
        }, 5000);

        await new Promise((resolve) => {
          this.server.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      this.server = null;
      this.serverPid = null;
    }
  }

  async makeRequest(path, options = {}) {
    const startTime = Date.now();
    const url = `${this.baseUrl}${path}`;
    const useHttps = url.startsWith('https://');
    const httpModule = useHttps ? https : http;

    return new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: 'localhost',
        port: this.port,
        path: path,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000,
      };

      const req = httpModule.request(reqOptions, (res) => {
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
          const endTime = Date.now();
          const latency = endTime - startTime;

          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            latency: latency,
            body: Buffer.concat(data).toString(),
            headers: res.headers,
            startTime: startTime,
            endTime: endTime,
          });
        });
      });

      req.on('error', (error) => {
        const endTime = Date.now();
        resolve({
          success: false,
          error: error.message,
          latency: endTime - startTime,
          startTime: startTime,
          endTime: endTime,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = Date.now();
        resolve({
          success: false,
          error: '请求超时',
          latency: endTime - startTime,
          startTime: startTime,
          endTime: endTime,
        });
      });

      // 如果有请求体，发送请求体
      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async runLoadTest(config) {
    console.log(`\n🧪 ${config.name}`);
    console.log(
      `   📊 配置: ${config.requests} 请求, ${config.concurrency} 并发`,
    );
    console.log(`   🎯 路径: ${config.path}`);
    console.log(`   🕒 开始时间: ${new Date().toISOString()}`);

    const results = {
      name: config.name,
      totalRequests: config.requests,
      concurrency: config.concurrency,
      path: config.path,
      method: config.method || 'GET',
      startTime: Date.now(),
      requests: [],
      successes: 0,
      failures: 0,
      totalLatency: 0,
    };

    const batches = [];
    for (let i = 0; i < config.requests; i += config.concurrency) {
      const batchSize = Math.min(config.concurrency, config.requests - i);
      batches.push(batchSize);
    }

    let completedRequests = 0;
    let batchIndex = 0;

    for (const batchSize of batches) {
      batchIndex++;
      console.log(
        `   🔄 处理批次 ${batchIndex}/${batches.length} (${batchSize} 请求)`,
      );

      const batchPromises = [];
      for (let j = 0; j < batchSize; j++) {
        batchPromises.push(
          this.makeRequest(config.path, {
            method: config.method,
            headers: config.headers,
            body: config.body,
            timeout: config.timeout || 10000,
          }),
        );
      }

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const reqResult = result.value;
          results.requests.push(reqResult);
          results.totalLatency += reqResult.latency;

          if (reqResult.success) {
            results.successes++;
          } else {
            results.failures++;
          }
        } else {
          results.failures++;
          results.requests.push({
            success: false,
            error: result.reason?.message || '未知错误',
            latency: 0,
          });
        }
      }

      completedRequests += batchSize;
      const progress = ((completedRequests / config.requests) * 100).toFixed(1);
      console.log(
        `   📈 进度: ${progress}% (${completedRequests}/${config.requests})`,
      );
    }

    results.endTime = Date.now();
    results.totalTime = results.endTime - results.startTime;
    results.avgLatency = results.totalLatency / results.requests.length;

    // 计算延迟的统计信息
    const latencies = results.requests
      .map((r) => r.latency)
      .filter((l) => l > 0);
    results.minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    results.maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    results.medianLatency = this.calculateMedian(latencies);
    results.p95Latency = this.calculatePercentile(latencies, 95);
    results.p99Latency = this.calculatePercentile(latencies, 99);

    results.successRate = (results.successes / results.totalRequests) * 100;
    results.requestsPerSecond =
      results.totalRequests / (results.totalTime / 1000);

    this.printResults(results);
    this.results.push(results);

    return results;
  }

  calculateMedian(values) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  printResults(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 负载测试结果');
    console.log('='.repeat(60));
    console.log(`📝 测试名称: ${results.name}`);
    console.log(`🎯 测试路径: ${results.path}`);
    console.log(`📈 总请求数: ${results.totalRequests.toLocaleString()}`);
    console.log(`✅ 成功请求: ${results.successes.toLocaleString()}`);
    console.log(`❌ 失败请求: ${results.failures.toLocaleString()}`);
    console.log(`📊 成功率: ${results.successRate.toFixed(2)}%`);
    console.log(`⏱️  总耗时: ${(results.totalTime / 1000).toFixed(2)} 秒`);
    console.log(`⚡ 请求/秒: ${results.requestsPerSecond.toFixed(2)}`);
    console.log(`📉 平均延迟: ${results.avgLatency.toFixed(2)}ms`);
    console.log(`🏎️  最小延迟: ${results.minLatency.toFixed(2)}ms`);
    console.log(`🐢 最大延迟: ${results.maxLatency.toFixed(2)}ms`);
    console.log(`📊 中位数延迟: ${results.medianLatency.toFixed(2)}ms`);
    console.log(`📈 P95延迟: ${results.p95Latency.toFixed(2)}ms`);
    console.log(`📈 P99延迟: ${results.p99Latency.toFixed(2)}ms`);
    console.log('='.repeat(60));
  }

  async runComprehensiveLoadTest() {
    try {
      // 启动服务器
      await this.startServer();

      console.log('\n' + '='.repeat(60));
      console.log('🚀 Koa Template App 负载测试');
      console.log('='.repeat(60));

      const testScenarios = [
        {
          name: '基础健康检查测试 (低并发)',
          path: '/api/health',
          requests: 1000,
          concurrency: 10,
          method: 'GET',
        },
        {
          name: '中等并发测试',
          path: '/api/health',
          requests: 5000,
          concurrency: 50,
          method: 'GET',
        },
        {
          name: '高并发测试',
          path: '/api/health',
          requests: 10000,
          concurrency: 100,
          method: 'GET',
        },
        {
          name: '根路径测试',
          path: '/',
          requests: 3000,
          concurrency: 30,
          method: 'GET',
        },
        {
          name: 'API端点测试',
          path: '/api/users',
          requests: 2000,
          concurrency: 20,
          method: 'GET',
        },
        {
          name: '极限并发测试',
          path: '/api/health',
          requests: 20000,
          concurrency: 200,
          method: 'GET',
        },
      ];

      for (const scenario of testScenarios) {
        try {
          await this.runLoadTest(scenario);

          // 测试之间休息一下
          if (scenario !== testScenarios[testScenarios.length - 1]) {
            console.log('\n   💤 休息 5 秒...\n');
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(`   ❌ 测试失败: ${error.message}`);
        }
      }

      // 生成报告
      if (this.results.length > 0) {
        await this.generateReport();
      } else {
        console.log('⚠️  没有测试结果可生成报告');
      }
    } catch (error) {
      console.error('❌ 负载测试失败:', error.message);
    } finally {
      // 停止服务器
      await this.stopServer();
      console.log('\n✅ 负载测试完成');
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 负载测试报告摘要');
    console.log('='.repeat(60));

    const summary = {
      totalTests: this.results.length,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTime: 0,
      avgRPS: 0,
      avgSuccessRate: 0,
      minLatencyOverall: Infinity,
      maxLatencyOverall: 0,
      avgLatencyOverall: 0,
    };

    this.results.forEach((result) => {
      summary.totalRequests += result.totalRequests;
      summary.totalSuccesses += result.successes;
      summary.totalFailures += result.failures;
      summary.totalTime += result.totalTime;
      summary.avgRPS += result.requestsPerSecond;
      summary.avgSuccessRate += result.successRate;
      summary.minLatencyOverall = Math.min(
        summary.minLatencyOverall,
        result.minLatency,
      );
      summary.maxLatencyOverall = Math.max(
        summary.maxLatencyOverall,
        result.maxLatency,
      );
      summary.avgLatencyOverall += result.avgLatency;
    });

    summary.avgRPS /= this.results.length;
    summary.avgSuccessRate /= this.results.length;
    summary.avgLatencyOverall /= this.results.length;

    console.log(`📈 总测试场景: ${summary.totalTests}`);
    console.log(`🎯 总请求数: ${summary.totalRequests.toLocaleString()}`);
    console.log(`✅ 总成功数: ${summary.totalSuccesses.toLocaleString()}`);
    console.log(`❌ 总失败数: ${summary.totalFailures.toLocaleString()}`);
    console.log(`📊 平均成功率: ${summary.avgSuccessRate.toFixed(2)}%`);
    console.log(`⏱️  总测试时间: ${(summary.totalTime / 1000).toFixed(2)} 秒`);
    console.log(`⚡ 平均请求/秒: ${summary.avgRPS.toFixed(2)}`);
    console.log(`📉 平均延迟: ${summary.avgLatencyOverall.toFixed(2)}ms`);
    console.log(`🏎️  最佳延迟: ${summary.minLatencyOverall.toFixed(2)}ms`);
    console.log(`🐢 最差延迟: ${summary.maxLatencyOverall.toFixed(2)}ms`);

    // 生成HTML报告
    const report = this.generateHTMLReport(summary);
    const reportPath = path.join(__dirname, '../load-test-report.html');
    await writeFile(reportPath, report);
    console.log(`\n📄 详细报告已生成: file://${reportPath}`);
  }

  generateHTMLReport(summary) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Koa Template App - 负载测试报告</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .summary { background: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metric-card.good { border-left: 5px solid #28a745; }
        .metric-card.warning { border-left: 5px solid #ffc107; }
        .metric-card.bad { border-left: 5px solid #dc3545; }
        .metric-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .metric-label { color: #666; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        th { background: #f8f9fa; padding: 15px; text-align: left; font-weight: 600; }
        td { padding: 15px; border-top: 1px solid #dee2e6; }
        tr:hover { background: #f8f9fa; }
        .status-good { color: #28a745; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
        .status-bad { color: #dc3545; font-weight: bold; }
        .progress-bar { height: 10px; background: #e9ecef; border-radius: 5px; margin: 10px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: #28a745; }
        h1, h2, h3 { margin-top: 0; }
        .timestamp { color: rgba(255,255,255,0.8); font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Koa Template App 负载测试报告</h1>
            <p class="timestamp">生成时间: ${new Date().toLocaleString()}</p>
            <p class="timestamp">测试端口: ${this.port}</p>
        </div>
        
        <div class="summary">
            <h2>📊 测试摘要</h2>
            <div class="metrics">
                <div class="metric-card ${summary.avgSuccessRate > 99 ? 'good' : summary.avgSuccessRate > 95 ? 'warning' : 'bad'}">
                    <div class="metric-label">平均成功率</div>
                    <div class="metric-value">${summary.avgSuccessRate.toFixed(2)}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, summary.avgSuccessRate)}%"></div>
                    </div>
                </div>
                
                <div class="metric-card ${summary.avgRPS > 1000 ? 'good' : summary.avgRPS > 500 ? 'warning' : 'bad'}">
                    <div class="metric-label">平均RPS</div>
                    <div class="metric-value">${summary.avgRPS.toFixed(2)}</div>
                    <div class="metric-label">请求/秒</div>
                </div>
                
                <div class="metric-card ${summary.avgLatencyOverall < 50 ? 'good' : summary.avgLatencyOverall < 200 ? 'warning' : 'bad'}">
                    <div class="metric-label">平均延迟</div>
                    <div class="metric-value">${summary.avgLatencyOverall.toFixed(2)}ms</div>
                    <div class="metric-label">毫秒</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">总请求数</div>
                    <div class="metric-value">${summary.totalRequests.toLocaleString()}</div>
                    <div class="metric-label">请求</div>
                </div>
            </div>
        </div>
        
        <h2>📈 详细测试结果</h2>
        <table>
            <thead>
                <tr>
                    <th>测试场景</th>
                    <th>请求数</th>
                    <th>并发数</th>
                    <th>成功率</th>
                    <th>RPS</th>
                    <th>平均延迟</th>
                    <th>P95延迟</th>
                    <th>P99延迟</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                ${this.results
                  .map(
                    (result) => `
                <tr>
                    <td>${result.name}</td>
                    <td>${result.totalRequests.toLocaleString()}</td>
                    <td>${result.concurrency}</td>
                    <td class="${result.successRate > 99 ? 'status-good' : result.successRate > 95 ? 'status-warning' : 'status-bad'}">
                        ${result.successRate.toFixed(2)}%
                    </td>
                    <td>${result.requestsPerSecond.toFixed(2)}</td>
                    <td class="${result.avgLatency < 50 ? 'status-good' : result.avgLatency < 200 ? 'status-warning' : 'status-bad'}">
                        ${result.avgLatency.toFixed(2)}ms
                    </td>
                    <td>${result.p95Latency.toFixed(2)}ms</td>
                    <td>${result.p99Latency.toFixed(2)}ms</td>
                    <td class="${result.successRate > 99 && result.avgLatency < 100 ? 'status-good' : 'status-warning'}">
                        ${result.successRate > 99 && result.avgLatency < 100 ? '✅ 优秀' : result.successRate > 95 ? '⚠️ 良好' : '❌ 需优化'}
                    </td>
                </tr>
                `,
                  )
                  .join('')}
            </tbody>
        </table>
        
        <div style="margin-top: 40px; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3>💡 性能建议</h3>
            ${
              summary.avgSuccessRate < 95
                ? '<p>⚠️ <strong>成功率偏低</strong>: 建议检查服务器错误日志，优化错误处理机制。</p>'
                : '<p>✅ <strong>成功率优秀</strong>: 服务器稳定性良好。</p>'
            }
            
            ${
              summary.avgLatencyOverall > 200
                ? '<p>⚠️ <strong>延迟较高</strong>: 建议优化数据库查询、添加缓存或升级服务器配置。</p>'
                : summary.avgLatencyOverall > 50
                  ? '<p>⚠️ <strong>延迟中等</strong>: 有优化空间，建议审查中间件性能。</p>'
                  : '<p>✅ <strong>延迟优秀</strong>: 响应速度很快。</p>'
            }
            
            ${
              summary.avgRPS < 500
                ? '<p>⚠️ <strong>吞吐量偏低</strong>: 建议优化代码性能或考虑水平扩展。</p>'
                : '<p>✅ <strong>吞吐量良好</strong>: 服务器处理能力充足。</p>'
            }
            
            <p><strong>测试配置说明</strong>: 本测试运行于端口 ${this.port}，共执行 ${summary.totalTests} 个测试场景，涵盖从低并发到高并发的多种情况。</p>
        </div>
    </div>
</body>
</html>`;
  }
}

// 运行负载测试
if (require.main === module) {
  const loadTest = new LoadTest();
  loadTest.runComprehensiveLoadTest().catch(console.error);
}

module.exports = LoadTest;
