#!/usr/bin/env node

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { spawn, exec } = require('child_process');

const writeFile = promisify(fs.writeFile);
const execAsync = promisify(exec);

class EnhancedLoadTest {
  constructor() {
    this.port = 3300; // 默认端口
    this.server = null;
    this.results = [];
    this.currentInstance = null;
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
    console.log(`🚀 启动测试服务器 (端口: ${this.port})...`);

    // 清理可能占用端口的进程
    await this.killPortProcess(this.port);

    // 首先构建项目
    console.log('🔨 构建项目...');
    await new Promise((resolve, reject) => {
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
        console.log('✅ 构建完成');
        resolve();
      });
    });

    // 启动服务器
    return new Promise((resolve, reject) => {
      this.server = spawn(
        'node',
        [path.join(__dirname, '../../dist/index.js')],
        {
          env: {
            ...process.env,
            PORT: this.port.toString(),
            NODE_ENV: 'production',
            LOG_LEVEL: 'error',
            ENABLE_SWAGGER: 'false',
            JWT_SECRET: 'load_test_secret_key',
            RATE_LIMIT_ENABLED: 'false',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        },
      );

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
          output.includes('地址:') ||
          output.includes('Server started') ||
          output.includes('listening on port')
        ) {
          clearTimeout(timeout);
          started = true;
          console.log(`✅ 测试服务器已启动 (端口: ${this.port})`);
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
          if (this.port > 3010) {
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
  }

  async stopServer() {
    if (this.server) {
      console.log('🛑 停止测试服务器...');

      // 等待请求完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (process.platform === 'win32') {
        try {
          const pid = this.server.pid;
          if (pid) {
            await execAsync(`taskkill /F /PID ${pid} /T`, { shell: true });
            console.log('✅ 服务器已停止');
          }
        } catch (error) {
          console.log(`⚠️  taskkill失败: ${error.message}`);
          this.server.kill();
        }
      } else {
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
    }
  }

  async runTestScenario(scenario) {
    console.log(`\n📊 运行测试场景: ${scenario.name}`);
    console.log(
      `  连接数: ${scenario.connections}, 持续时间: ${scenario.duration}秒`,
    );

    // 准备请求配置
    const requests = scenario.requests.map((req) => ({
      method: req.method,
      path: req.path,
      body: req.body || undefined,
      headers: req.headers || { 'content-type': 'application/json' },
    }));

    return new Promise((resolve, reject) => {
      const instance = autocannon(
        {
          url: `http://localhost:${this.port}`,
          connections: scenario.connections,
          duration: scenario.duration,
          requests: requests,
          timeout: 30,
          workers: 4,
          pipelining: 1,
          bailout: 100,
        },
        (err, result) => {
          // 清除任何可能的进度条输出
          process.stdout.clearLine();
          process.stdout.cursorTo(0);

          if (err) {
            reject(err);
            return;
          }

          // 调试输出，查看 autocannon 返回的结果结构
          // console.log('Autocannon result:', JSON.stringify(result, null, 2));

          // 正确提取 autocannon 结果
          // 根据 autocannon 文档，result 结构如下：
          // {
          //   title: '',
          //   url: '',
          //   socketPath: '',
          //   requests: { average: 0, mean: 0, stddev: 0, min: 0, max: 0, total: 0, p0_001: 0, ... },
          //   latency: { average: 0, mean: 0, stddev: 0, min: 0, max: 0, p0_001: 0, ... },
          //   throughput: { average: 0, mean: 0, stddev: 0, min: 0, max: 0, total: 0 },
          //   errors: 0,
          //   timeouts: 0,
          //   duration: 0,
          //   start: '2025-12-26T03:22:56.222Z',
          //   finish: '2025-12-26T03:23:26.240Z',
          //   connections: 10,
          //   pipelining: 1,
          //   workers: 4,
          //   ...
          // }

          // 安全提取函数
          const safe = (obj, prop, def = 0) => {
            if (!obj || obj[prop] === undefined || obj[prop] === null) {
              return def;
            }
            return obj[prop];
          };

          const report = {
            scenario: scenario.name,
            connections: scenario.connections,
            duration: scenario.duration,
            requests: {
              total: safe(result, 'requests')
                ? safe(result.requests, 'total', 0)
                : 0,
              average: safe(result, 'requests')
                ? safe(result.requests, 'average', 0)
                : 0,
            },
            latency: {
              average: safe(result, 'latency')
                ? safe(result.latency, 'average', 0)
                : 0,
              mean: safe(result, 'latency')
                ? safe(result.latency, 'mean', 0)
                : 0,
              p50: safe(result, 'latency') ? safe(result.latency, 'p50', 0) : 0,
              p95: safe(result, 'latency') ? safe(result.latency, 'p95', 0) : 0,
              p99: safe(result, 'latency') ? safe(result.latency, 'p99', 0) : 0,
              p2_5: safe(result, 'latency')
                ? safe(result.latency, 'p2_5', 0)
                : 0,
              p97_5: safe(result, 'latency')
                ? safe(result.latency, 'p97_5', 0)
                : 0,
            },
            throughput: {
              average: safe(result, 'throughput')
                ? safe(result.throughput, 'average', 0)
                : 0,
              mean: safe(result, 'throughput')
                ? safe(result.throughput, 'mean', 0)
                : 0,
              total: safe(result, 'throughput')
                ? safe(result.throughput, 'total', 0)
                : 0,
            },
            errors: safe(result, 'errors', 0),
            timeouts: safe(result, 'timeouts', 0),
            durationActual: safe(result, 'duration', 0),
          };

          console.log(`\n✅ ${scenario.name} 完成`);
          console.log(`  请求总数: ${report.requests.total}`);

          // 使用 average 或 mean 中可用的值
          const avgLatency = report.latency.average || report.latency.mean || 0;
          console.log(`  平均响应时间: ${avgLatency.toFixed(2)}ms`);
          console.log(`  95%响应时间: ${report.latency.p95.toFixed(2)}ms`);

          const errorRate =
            report.requests.total > 0
              ? ((report.errors / report.requests.total) * 100).toFixed(2)
              : '0.00';
          console.log(`  错误率: ${errorRate}%`);

          const avgThroughput = report.requests.average || 0;
          console.log(`  请求/秒: ${avgThroughput.toFixed(2)}`);

          resolve(report);
        },
      );

      // 保存实例引用以便后续可能需要停止它
      this.currentInstance = instance;

      // 显示进度条，但不使用 autocannon.track 来避免冲突
      let progressInterval;
      const startTime = Date.now();
      const totalDuration = scenario.duration * 1000; // 转为毫秒

      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(95, (elapsed / totalDuration) * 100);

        // 显示进度条
        const width = 40;
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        const percent = Math.round(progress);

        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
        process.stdout.write(`  测试进度 [${progressBar}] ${percent}%`);

        if (progress >= 100) {
          clearInterval(progressInterval);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
        }
      }, 500);

      // 测试完成时清除定时器
      instance.on('done', () => {
        if (progressInterval) {
          clearInterval(progressInterval);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
        }
        this.currentInstance = null;
      });
    });
  }

  async runLoadTest() {
    console.log('🚀 开始增强版负载测试...');

    const testScenarios = [
      {
        name: '低并发测试',
        connections: 10,
        duration: 10,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '中并发测试',
        connections: 50,
        duration: 20,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/echo/test' },
        ],
      },
      {
        name: '高并发测试',
        connections: 100,
        duration: 30,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/echo/test' },
          {
            method: 'POST',
            path: '/api/echo',
            body: JSON.stringify({ message: '负载测试' }),
          },
        ],
      },
      {
        name: '峰值测试',
        connections: 200,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance' },
        ],
      },
    ];

    try {
      // 启动服务器
      await this.startServer();

      // 等待服务器完全启动
      console.log('\n⏳ 等待服务器稳定...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 运行测试场景
      for (const scenario of testScenarios) {
        try {
          const result = await this.runTestScenario(scenario);
          this.results.push(result);

          // 每个测试之间休息一下
          if (scenario !== testScenarios[testScenarios.length - 1]) {
            console.log('   💤 休息 5 秒...');
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(
            `\n❌ 测试场景 ${scenario.name} 失败: ${error.message}`,
          );
          // 继续执行下一个测试
        }
      }

      // 生成报告
      if (this.results.length > 0) {
        await this.generateReport();
      } else {
        console.log('\n⚠️  没有成功的测试结果，无法生成报告');
      }
    } catch (error) {
      console.error('\n❌ 负载测试失败:', error.message);
    } finally {
      await this.stopServer();
      console.log('\n🎉 增强版负载测试完成！');
    }
  }

  async generateReport() {
    const reportDir = path.join(__dirname, '../../reports/performance');

    // 确保目录存在
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'enhanced-load-test-report.html');

    // 计算安全的值
    const safeValue = (value, defaultValue = 0) => {
      return value !== undefined && value !== null && !isNaN(value)
        ? value
        : defaultValue;
    };

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koa Template App - 增强负载测试报告</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .summary {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .scenario {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .metric {
            display: inline-block;
            background: #e9ecef;
            padding: 8px 12px;
            margin: 5px;
            border-radius: 4px;
            font-weight: bold;
        }
        .good { background-color: #d4edda; color: #155724; }
        .warning { background-color: #fff3cd; color: #856404; }
        .bad { background-color: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Koa Template App - 增强负载测试报告</h1>
        <p>版本: 1.4.0 | 生成时间: ${new Date().toISOString()} | 测试端口: ${this.port}</p>
    </div>

    <div class="summary">
        <h2>测试概览</h2>
        <p>总测试场景: ${this.results.length}</p>
        <p>总请求数: ${this.results.reduce((sum, r) => sum + safeValue(r.requests.total), 0).toLocaleString()}</p>
        <p>总测试时长: ${this.results.reduce((sum, r) => sum + safeValue(r.duration), 0).toFixed(2)} 秒</p>
    </div>

    ${this.results
      .map((item, index) => {
        const totalRequests = safeValue(item.requests.total);
        const avgLatency =
          safeValue(item.latency.average) || safeValue(item.latency.mean);
        const p95Latency = safeValue(item.latency.p95);
        const p99Latency = safeValue(item.latency.p99);
        const errorRate =
          totalRequests > 0
            ? (safeValue(item.errors) / totalRequests) * 100
            : 0;
        const requestsPerSecond = safeValue(item.requests.average);
        const throughputMB = safeValue(item.throughput.total) / 1024 / 1024;

        return `
    <div class="scenario">
        <h3>测试场景 ${index + 1}: ${item.scenario}</h3>
        
        <div>
            <span class="metric">连接数: ${item.connections}</span>
            <span class="metric">持续时间: ${item.duration}秒</span>
            <span class="metric">吞吐量: ${throughputMB.toFixed(2)} MB/s</span>
        </div>

        <table>
            <tr>
                <th>指标</th>
                <th>值</th>
                <th>状态</th>
            </tr>
            <tr>
                <td>总请求数</td>
                <td>${totalRequests.toLocaleString()}</td>
                <td><span class="metric ${totalRequests > 10000 ? 'good' : totalRequests > 1000 ? 'warning' : 'bad'}">${totalRequests > 10000 ? '优秀' : totalRequests > 1000 ? '良好' : '较低'}</span></td>
            </tr>
            <tr>
                <td>平均响应时间</td>
                <td>${avgLatency.toFixed(2)}ms</td>
                <td><span class="metric ${avgLatency < 50 ? 'good' : avgLatency < 200 ? 'warning' : 'bad'}">${avgLatency < 50 ? '快速' : avgLatency < 200 ? '可接受' : '较慢'}</span></td>
            </tr>
            <tr>
                <td>95%响应时间</td>
                <td>${p95Latency.toFixed(2)}ms</td>
                <td><span class="metric ${p95Latency < 100 ? 'good' : p95Latency < 500 ? 'warning' : 'bad'}">${p95Latency < 100 ? '优秀' : p95Latency < 500 ? '良好' : '需优化'}</span></td>
            </tr>
            <tr>
                <td>99%响应时间</td>
                <td>${p99Latency.toFixed(2)}ms</td>
                <td><span class="metric ${p99Latency < 200 ? 'good' : p99Latency < 1000 ? 'warning' : 'bad'}">评估</span></td>
            </tr>
            <tr>
                <td>错误率</td>
                <td>${errorRate.toFixed(2)}%</td>
                <td><span class="metric ${errorRate < 1 ? 'good' : errorRate < 5 ? 'warning' : 'bad'}">${errorRate < 1 ? '优秀' : errorRate < 5 ? '可接受' : '需修复'}</span></td>
            </tr>
            <tr>
                <td>请求/秒</td>
                <td>${requestsPerSecond.toFixed(2)}</td>
                <td><span class="metric ${requestsPerSecond > 100 ? 'good' : requestsPerSecond > 50 ? 'warning' : 'bad'}">${requestsPerSecond > 100 ? '高' : requestsPerSecond > 50 ? '中' : '低'}</span></td>
            </tr>
        </table>
    </div>
    `;
      })
      .join('')}

    <div class="summary">
        <h2>性能建议</h2>
        <ul>
            <li>如果平均响应时间超过200ms，考虑优化中间件顺序</li>
            <li>如果错误率超过1%，检查服务器资源限制</li>
            <li>95%响应时间应保持在500ms以内以获得良好用户体验</li>
            <li>考虑使用集群模式处理高并发场景</li>
        </ul>
    </div>
</body>
</html>`;

    await writeFile(reportPath, html);
    console.log(`📄 报告已生成: ${reportPath}`);
  }
}

// 运行测试
if (require.main === module) {
  const loadTest = new EnhancedLoadTest();
  loadTest.runLoadTest().catch(console.error);
}

module.exports = EnhancedLoadTest;
