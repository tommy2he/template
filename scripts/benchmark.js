#!/usr/bin/env node

const autocannon = require('autocannon');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const execAsync = promisify(exec);

class Benchmark {
  constructor(options = {}) {
    this.port = options.port || 3002;
    this.server = null;
    this.serverPid = null;
    this.results = [];
  }

  // 清理占用端口的进程
  async killPortProcess(port) {
    try {
      if (process.platform === 'win32') {
        // Windows: 查找并杀死占用端口的进程
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
      // 等待端口释放
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`⚠️  清理端口时出错: ${error.message}`);
    }
  }

  async startServer() {
    console.log(`🚀 启动测试服务器 (端口: ${this.port})...`);

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
          if (
            output.includes('启动成功') ||
            output.includes('Server started') ||
            output.includes('listening on port') ||
            output.includes(`:${this.port}`)
          ) {
            clearTimeout(timeout);
            started = true;
            console.log(`✅ 测试服务器已启动在端口 ${this.port}`);
            setTimeout(resolve, 2000);
          }
        });

        this.server.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          if (errorOutput.includes('EADDRINUSE')) {
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
    console.log('🛑 停止测试服务器...');

    if (this.server) {
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

  async runSingleBenchmark(config) {
    console.log(`\n🧪 ${config.title}`);
    console.log(`   📊 ${config.connections} 连接, ${config.duration} 秒`);

    try {
      const result = await autocannon(config);

      console.log(`   ✅ 完成: ${result.requests.total} 请求`);
      console.log(`   📈 平均延迟: ${result.latency.average.toFixed(2)}ms`);
      console.log(`   ⚡ 请求/秒: ${result.requests.average.toFixed(2)}`);
      console.log(`   🔴 错误率: ${result.errors}%`);
      console.log(
        `   📤 吞吐量: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`,
      );

      this.results.push({
        name: config.title,
        ...result,
      });

      return result;
    } catch (error) {
      console.error(`   ❌ 测试失败: ${error.message}`);
      return null;
    }
  }

  async runComprehensiveBenchmark() {
    try {
      // 启动服务器
      await this.startServer();

      console.log('\n📊 开始性能基准测试...');
      console.log('='.repeat(50));

      const baseUrl = `http://localhost:${this.port}`;

      // 测试场景1: 健康检查API测试
      await this.runSingleBenchmark({
        title: '健康检查API测试 (低并发)',
        url: `${baseUrl}/api/health`,
        connections: 50,
        duration: 10,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // 测试场景2: 根路径测试
      await this.runSingleBenchmark({
        title: '根路径测试 (中等并发)',
        url: `${baseUrl}/`,
        connections: 30,
        duration: 15,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // 测试场景3: 用户列表API测试
      await this.runSingleBenchmark({
        title: '用户列表API测试',
        url: `${baseUrl}/api/users`,
        connections: 100,
        duration: 20,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // 测试场景4: 混合请求测试
      await this.runSingleBenchmark({
        title: '混合请求测试',
        url: [
          { method: 'GET', url: `${baseUrl}/api/health` },
          { method: 'GET', url: `${baseUrl}/` },
        ],
        connections: 80,
        duration: 25,
        pipelining: 1,
      });

      // 测试场景5: 压力测试
      await this.runSingleBenchmark({
        title: '压力测试 (高并发)',
        url: `${baseUrl}/api/health`,
        connections: 200,
        duration: 30,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('\n' + '='.repeat(50));
      console.log('🎉 所有测试完成！');
      console.log('='.repeat(50));

      // 生成报告
      if (this.results.length > 0) {
        await this.generateReport();
      }
    } catch (error) {
      console.error('❌ 基准测试失败:', error.message);
    } finally {
      // 停止服务器
      await this.stopServer();
      console.log('\n✅ 基准测试完成');
      process.exit(0);
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

    this.results.forEach((result) => {
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
        <p>测试端口: ${this.port}</p>
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
