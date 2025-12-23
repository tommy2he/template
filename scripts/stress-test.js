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

    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      totalTime: 0,
      maxRPS: 0,
      minLatency: Infinity,
      maxLatency: 0,
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
    });

    // 如果没有有效的延迟数据
    if (summary.minLatency === Infinity) summary.minLatency = 0;

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
        <p>测试端口: ${this.port}</p>
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
        
        ${
          summary.maxRPS < 100
            ? '<p>⚠️ <strong>警告</strong>: RPS较低，建议优化代码性能或增加服务器资源。</p>'
            : summary.maxRPS < 500
              ? '<p>ℹ️ <strong>中等</strong>: RPS表现中等，有优化空间。</p>'
              : '<p>✅ <strong>优秀</strong>: RPS表现优秀。</p>'
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
