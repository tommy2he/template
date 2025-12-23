#!/usr/bin/env node

const loadtest = require('loadtest');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const execAsync = promisify(exec);

class StressTest {
  constructor(options = {}) {
    this.port = options.port || 3003;
    this.server = null;
    this.serverPid = null;
    this.results = [];
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
    console.log(`🚀 启动压力测试服务器 (端口: ${this.port})...`);

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
            console.log('✅ 压力测试服务器已启动');
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

          console.error('服务器错误:', data.toString());
        });

        this.server.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      buildProcess.on('error', (error) => {
        console.error('构建过程中发生错误:', error);
        reject(new Error(`构建失败: ${error.message}`));
      });
    });
  }

  async stopServer() {
    if (this.server) {
      console.log('🛑 停止压力测试服务器...');

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
          this.server.kill();
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

          // 安全地访问可能不存在的属性
          const meanLatencyMs = result.meanLatencyMs || 0;
          const rps = result.rps || 0;
          const errorPercent = result.errorPercent || 0;
          const totalErrors = result.totalErrors || 0;

          console.log(`   📈 平均延迟: ${meanLatencyMs.toFixed(2)}ms`);
          console.log(`   ⚡ 请求/秒: ${rps.toFixed(2)}`);
          console.log(`   🔴 错误率: ${errorPercent.toFixed(2)}%`);

          resolve({
            name: config.name,
            concurrency: config.concurrency,
            maxRequests: config.maxRequests,
            totalRequests: result.totalRequests || 0,
            totalErrors: totalErrors,
            meanLatencyMs: meanLatencyMs,
            rps: rps,
            errorPercent: errorPercent,
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
          console.error(`   ❌ 跳过此测试: ${error.message}`);
        }
      }

      await this.generateReport();
    } catch (error) {
      console.error('❌ 压力测试失败:', error.message);
    } finally {
      await this.stopServer();
      console.log('\n✅ 压力测试完成');
    }
  }

  async generateReport() {
    if (this.results.length === 0) {
      console.log('⚠️  没有测试结果可生成报告');
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 压力测试报告');
    console.log('='.repeat(50));

    const summary = this.calculateSummary();
    this.printSummary(summary);

    // 生成HTML报告
    const report = this.generateHTMLReport(summary);
    const reportPath = path.join(__dirname, '../stress-report.html');
    await writeFile(reportPath, report);
    console.log(`\n📄 压力测试报告已生成: file://${reportPath}`);
  }

  calculateSummary() {
    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      totalTime: 0,
      maxRPS: 0,
      minLatency: Infinity,
      maxLatency: 0,
      avgLatency: 0,
      avgRPS: 0,
      avgErrorRate: 0,
    };

    this.results.forEach((result) => {
      summary.totalRequests += result.totalRequests || 0;
      summary.totalErrors += result.totalErrors || 0;
      summary.totalTime += result.elapsedTime || 0;
      summary.maxRPS = Math.max(summary.maxRPS, result.rps || 0);
      summary.minLatency = Math.min(
        summary.minLatency,
        result.meanLatencyMs || Infinity,
      );
      summary.maxLatency = Math.max(
        summary.maxLatency,
        result.meanLatencyMs || 0,
      );
      summary.avgLatency += result.meanLatencyMs || 0;
      summary.avgRPS += result.rps || 0;
      summary.avgErrorRate += result.errorPercent || 0;
    });

    const count = this.results.length;
    summary.avgLatency /= count;
    summary.avgRPS /= count;
    summary.avgErrorRate /= count;

    // 如果没有有效的延迟数据
    if (summary.minLatency === Infinity) summary.minLatency = 0;

    return summary;
  }

  printSummary(summary) {
    console.log(`📈 总请求数: ${summary.totalRequests.toLocaleString()}`);
    console.log(`⚠️  总错误数: ${summary.totalErrors}`);
    console.log(`⏱️  总耗时: ${(summary.totalTime / 1000).toFixed(2)} 秒`);
    console.log(`⚡ 最高请求/秒: ${summary.maxRPS.toFixed(2)}`);
    console.log(`📉 最低延迟: ${summary.minLatency.toFixed(2)}ms`);
    console.log(`📈 最高延迟: ${summary.maxLatency.toFixed(2)}ms`);
    console.log(`📊 平均延迟: ${summary.avgLatency.toFixed(2)}ms`);
    console.log(`⚡ 平均RPS: ${summary.avgRPS.toFixed(2)}`);
    console.log(`🔴 平均错误率: ${summary.avgErrorRate.toFixed(2)}%`);
  }

  generateHTMLReport(summary) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Koa Template App - 压力测试报告</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #d9534f 0%, #b52b27 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
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
        .section { margin-bottom: 30px; }
    </style>
</head>
<body>
    <div class="container">
        ${this.generateHeader()}
        ${this.generateSummarySection(summary)}
        ${this.generateResultsTable()}
        ${this.generatePerformanceGuidelines()}
        ${this.generateRecommendations(summary)}
    </div>
</body>
</html>`;
  }

  generateHeader() {
    return `
        <div class="header">
            <h1>Koa Template App 压力测试报告</h1>
            <p class="timestamp">生成时间: ${new Date().toLocaleString()}</p>
            <p class="timestamp">测试端口: ${this.port}</p>
        </div>`;
  }

  generateSummarySection(summary) {
    return `
        <div class="summary">
            <h2>📊 测试摘要</h2>
            <div class="metrics">
                <div class="metric-card ${summary.avgErrorRate === 0 ? 'good' : summary.avgErrorRate < 1 ? 'warning' : 'bad'}">
                    <div class="metric-label">平均错误率</div>
                    <div class="metric-value">${summary.avgErrorRate.toFixed(2)}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.max(0, 100 - summary.avgErrorRate)}%"></div>
                    </div>
                </div>
                
                <div class="metric-card ${summary.avgRPS > 1000 ? 'good' : summary.avgRPS > 500 ? 'warning' : 'bad'}">
                    <div class="metric-label">平均RPS</div>
                    <div class="metric-value">${summary.avgRPS.toFixed(2)}</div>
                    <div class="metric-label">请求/秒</div>
                </div>
                
                <div class="metric-card ${summary.avgLatency < 50 ? 'good' : summary.avgLatency < 200 ? 'warning' : 'bad'}">
                    <div class="metric-label">平均延迟</div>
                    <div class="metric-value">${summary.avgLatency.toFixed(2)}ms</div>
                    <div class="metric-label">毫秒</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">总请求数</div>
                    <div class="metric-value">${summary.totalRequests.toLocaleString()}</div>
                    <div class="metric-label">请求</div>
                </div>
            </div>
        </div>`;
  }

  generateResultsTable() {
    return `
        <div class="section">
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
                        (result) => `
                    <tr>
                        <td>${result.name}</td>
                        <td>${result.totalRequests.toLocaleString()}</td>
                        <td>${result.concurrency}</td>
                        <td class="${result.meanLatencyMs < 100 ? 'status-good' : result.meanLatencyMs < 500 ? 'status-warning' : 'status-bad'}">
                            ${result.meanLatencyMs.toFixed(2)}ms
                        </td>
                        <td>${result.rps.toFixed(2)}</td>
                        <td class="${result.errorPercent === 0 ? 'status-good' : result.errorPercent < 1 ? 'status-warning' : 'status-bad'}">
                            ${result.errorPercent.toFixed(2)}%
                        </td>
                        <td>${(result.elapsedTime / 1000).toFixed(2)}秒</td>
                    </tr>
                    `,
                      )
                      .join('')}
                </tbody>
            </table>
        </div>`;
  }

  generatePerformanceGuidelines() {
    return `
        <div class="section" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3>📈 性能指标说明</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                <div style="flex: 1; min-width: 300px;">
                    <h4>延迟分析:</h4>
                    <ul>
                        <li><span class="status-good">绿色 (&lt; 100ms)</span>: 优秀性能</li>
                        <li><span class="status-warning">黄色 (100-500ms)</span>: 可接受性能</li>
                        <li><span class="status-bad">红色 (&gt; 500ms)</span>: 需要优化</li>
                    </ul>
                </div>
                <div style="flex: 1; min-width: 300px;">
                    <h4>错误率分析:</h4>
                    <ul>
                        <li><span class="status-good">绿色 (0%)</span>: 完美</li>
                        <li><span class="status-warning">黄色 (&lt; 1%)</span>: 可接受</li>
                        <li><span class="status-bad">红色 (&gt;= 1%)</span>: 需要关注</li>
                    </ul>
                </div>
                <div style="flex: 1; min-width: 300px;">
                    <h4>RPS分析:</h4>
                    <ul>
                        <li><span class="status-good">绿色 (&gt; 1000)</span>: 优秀吞吐量</li>
                        <li><span class="status-warning">黄色 (500-1000)</span>: 中等吞吐量</li>
                        <li><span class="status-bad">红色 (&lt; 500)</span>: 低吞吐量</li>
                    </ul>
                </div>
            </div>
        </div>`;
  }

  generateRecommendations(summary) {
    let recommendations = [];

    if (summary.maxLatency > 500) {
      recommendations.push(
        '检测到高延迟，建议优化中间件顺序、添加缓存或升级服务器配置。',
      );
    }

    if (summary.totalErrors > 0) {
      recommendations.push('存在错误请求，建议检查错误日志并修复。');
    }

    if (summary.maxRPS < 100) {
      recommendations.push('RPS较低，建议优化代码性能或增加服务器资源。');
    } else if (summary.maxRPS < 500) {
      recommendations.push('RPS表现中等，有优化空间。');
    }

    if (
      summary.avgErrorRate === 0 &&
      summary.avgLatency < 100 &&
      summary.avgRPS > 1000
    ) {
      recommendations.push('应用性能表现优秀，继续保持！');
    }

    return `
        <div class="section" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3>💡 优化建议</h3>
            ${
              recommendations.length > 0
                ? `<ul>${recommendations.map((rec) => `<li>${rec}</li>`).join('')}</ul>`
                : '<p>所有性能指标均在优秀范围内，无需特别优化。</p>'
            }
            <p><strong>测试配置说明</strong>: 本测试运行于端口 ${this.port}，共执行 ${this.results.length} 个测试场景，涵盖从轻负载到极端并发的多种情况。</p>
        </div>`;
  }
}

// 运行压力测试
if (require.main === module) {
  const stressTest = new StressTest();
  stressTest.runStressTests().catch(console.error);
}

module.exports = StressTest;
