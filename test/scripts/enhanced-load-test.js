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
    this.port = 3300;
    this.server = null;
    this.results = [];
    this.currentInstance = null;
    this.performancePeak = null;
  }

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

    await this.killPortProcess(this.port);

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
            // 提高限制以便测试
            UV_THREADPOOL_SIZE: '64',
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
    console.log(
      `  测试端点: ${scenario.requests.map((r) => `${r.method} ${r.path}`).join(', ')}`,
    );

    const requests = scenario.requests.map((req) => ({
      method: req.method,
      path: req.path,
      body: req.body || undefined,
      headers: req.headers || { 'content-type': 'application/json' },
    }));

    return new Promise((resolve, reject) => {
      // 移除速率限制，让 autocannon 全力发送请求
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
          // 移除连接速率限制，让 autocannon 全力发送
          // connectionRate: Math.min(100, scenario.connections), // 移除
          // overallRate: Math.min(1000, scenario.connections * 10), // 移除
        },
        (err, result) => {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);

          if (err) {
            console.error(`❌ autocannon错误: ${err.message}`);
            reject(err);
            return;
          }

          if (!result) {
            console.error('❌ autocannon返回空结果');
            reject(new Error('autocannon返回空结果'));
            return;
          }

          const safe = (obj, prop, def = 0) => {
            if (!obj || obj[prop] === undefined || obj[prop] === null) {
              return def;
            }
            return obj[prop];
          };

          // 直接从 autocannon 结果提取数据
          const requestsTotal = safe(result, 'requests')
            ? safe(result.requests, 'total', 0)
            : 0;
          const latencyAvg = safe(result, 'latency')
            ? safe(result.latency, 'average', 0)
            : safe(result, 'latency')
              ? safe(result.latency, 'mean', 0)
              : 0;
          const latencyP95 = safe(result, 'latency')
            ? safe(result.latency, 'p95', 0)
            : 0;
          const latencyP99 = safe(result, 'latency')
            ? safe(result.latency, 'p99', 0)
            : 0;
          const requestsAvg = safe(result, 'requests')
            ? safe(result.requests, 'average', 0)
            : 0;
          const errors = safe(result, 'errors', 0);
          const timeouts = safe(result, 'timeouts', 0);

          const report = {
            scenario: scenario.name,
            connections: scenario.connections,
            duration: scenario.duration,
            requests: {
              total: requestsTotal,
              average: requestsAvg,
            },
            latency: {
              average: latencyAvg,
              p95: latencyP95,
              p99: latencyP99,
            },
            throughput: {
              total: safe(result, 'throughput')
                ? safe(result.throughput, 'total', 0)
                : 0,
            },
            errors: errors,
            timeouts: timeouts,
            durationActual: safe(result, 'duration', 0),
          };

          console.log(`\n✅ ${scenario.name} 完成`);
          console.log(`  请求总数: ${report.requests.total.toLocaleString()}`);
          console.log(`  平均响应时间: ${report.latency.average.toFixed(2)}ms`);
          console.log(`  95%响应时间: ${report.latency.p95.toFixed(2)}ms`);
          console.log(`  99%响应时间: ${report.latency.p99.toFixed(2)}ms`);

          const errorRate =
            report.requests.total > 0
              ? ((report.errors / report.requests.total) * 100).toFixed(2)
              : '0.00';
          console.log(`  错误率: ${errorRate}%`);

          console.log(`  超时数量: ${report.timeouts}`);
          console.log(`  请求/秒: ${report.requests.average.toFixed(2)}`);

          // 计算连接效率
          const efficiency =
            report.requests.total / (scenario.connections * scenario.duration);
          console.log(`  连接效率: ${efficiency.toFixed(2)} 请求/连接/秒`);

          // 吞吐量信息
          const throughputMB = (report.throughput.total / 1024 / 1024).toFixed(
            2,
          );
          console.log(`  吞吐量: ${throughputMB} MB`);

          if (report.timeouts > 0 || report.errors > 0) {
            console.log(
              `⚠️  警告: 测试中出现 ${report.errors} 个错误和 ${report.timeouts} 个超时`,
            );
          }

          resolve(report);
        },
      );

      this.currentInstance = instance;

      // 进度条
      let progressInterval;
      const startTime = Date.now();
      const totalDuration = scenario.duration * 1000;

      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(95, (elapsed / totalDuration) * 100);

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
    console.log('📝 测试说明: 逐步增加并发数，找到性能极限\n');

    // 使用与之前版本类似的测试场景
    const testScenarios = [
      {
        name: '基线测试 (10并发)',
        connections: 10,
        duration: 10, // 缩短时间以快速测试
        requests: [
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '低负载测试 (25并发)',
        connections: 25,
        duration: 15,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '中等负载测试 (50并发)',
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
        name: '高负载测试 (100并发)',
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
        name: '峰值测试 (150并发)',
        connections: 150,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance' },
        ],
      },
      {
        name: '极限测试 (200并发)',
        connections: 200,
        duration: 50,
        requests: [
          { method: 'GET', path: '/api/health' }, // 只测试最简单的接口
        ],
      },
    ];

    try {
      await this.startServer();

      console.log('\n⏳ 等待服务器稳定...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      let shouldStop = false;

      for (const scenario of testScenarios) {
        if (shouldStop) {
          console.log(`\n⏹️  检测到性能瓶颈，跳过后续测试: ${scenario.name}`);
          continue;
        }

        try {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`🔥 开始测试: ${scenario.name}`);
          console.log(`${'='.repeat(60)}`);

          const result = await this.runTestScenario(scenario);
          this.results.push(result);

          // 性能趋势分析
          if (this.results.length > 1) {
            const prevResult = this.results[this.results.length - 2];
            const currResult = this.results[this.results.length - 1];

            const prevRPS = prevResult.requests.average;
            const currRPS = currResult.requests.average;
            const prevLatency = prevResult.latency.average;
            const currLatency = currResult.latency.average;

            console.log('\n📈 性能趋势分析:');
            console.log(
              `  连接数变化: ${prevResult.connections} → ${currResult.connections}`,
            );
            console.log(
              `  RPS变化: ${prevRPS.toFixed(2)} → ${currRPS.toFixed(2)} (${(((currRPS - prevRPS) / prevRPS) * 100).toFixed(2)}%)`,
            );
            console.log(
              `  延迟变化: ${prevLatency.toFixed(2)}ms → ${currLatency.toFixed(2)}ms (${(((currLatency - prevLatency) / prevLatency) * 100).toFixed(2)}%)`,
            );

            // 如果RPS下降超过30%且延迟增加超过300%，标记性能瓶颈
            if (currRPS < prevRPS * 0.7 && currLatency > prevLatency * 4) {
              console.log('🚨 检测到性能显著下降，可能已达到性能瓶颈！');
              console.log(
                `💡 建议: 最佳并发数可能在 ${prevResult.connections} 左右`,
              );
              this.performancePeak = prevResult;
              shouldStop = true;
            }
          }

          // 检查当前测试是否达到性能极限
          if (
            result.timeouts > result.requests.total * 0.1 ||
            result.errors > result.requests.total * 0.05 ||
            result.latency.average > 1000
          ) {
            // 延迟超过1秒
            console.log('🚨 当前测试达到性能极限！');
            this.performancePeak = result;
            shouldStop = true;
          }

          if (
            !shouldStop &&
            scenario !== testScenarios[testScenarios.length - 1]
          ) {
            console.log('\n   💤 休息 5 秒，让服务器恢复...');
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(
            `\n❌ 测试场景 ${scenario.name} 失败: ${error.message}`,
          );
          shouldStop = true;
        }
      }

      // 生成报告
      if (this.results.length > 0) {
        await this.generateReport();
        await this.generatePerformanceAnalysis();
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
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'enhanced-load-test-report.html');

    const safeValue = (value, defaultValue = 0) => {
      return value !== undefined && value !== null && !isNaN(value)
        ? value
        : defaultValue;
    };

    // 找到性能峰值
    let peakPerformance = { rps: 0, index: -1 };
    this.results.forEach((result, index) => {
      const rps = safeValue(result.requests.average);
      if (rps > peakPerformance.rps) {
        peakPerformance.rps = rps;
        peakPerformance.index = index;
      }
    });

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
        .peak { background-color: #007bff; color: white; }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .analysis {
            background: #fff8e1;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 5px solid #ffc107;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Koa Template App - 增强负载测试报告</h1>
        <p>版本: 1.4.0 | 生成时间: ${new Date().toISOString()} | 测试端口: ${this.port}</p>
        ${
          peakPerformance.index >= 0
            ? `<p>🏆 最佳性能场景: ${this.results[peakPerformance.index].scenario} (${this.results[peakPerformance.index].connections} 并发)</p>`
            : ''
        }
    </div>

    <div class="summary">
        <h2>测试概览</h2>
        <p>总测试场景: ${this.results.length}</p>
        <p>总请求数: ${this.results.reduce((sum, r) => sum + safeValue(r.requests.total), 0).toLocaleString()}</p>
        <p>总测试时长: ${this.results.reduce((sum, r) => sum + safeValue(r.duration), 0).toFixed(2)} 秒</p>
        <p>总错误数: ${this.results.reduce((sum, r) => sum + safeValue(r.errors), 0)}</p>
        <p>总超时数: ${this.results.reduce((sum, r) => sum + safeValue(r.timeouts), 0)}</p>
    </div>

    ${this.results
      .map((item, index) => {
        const totalRequests = safeValue(item.requests.total);
        const avgLatency = safeValue(item.latency.average);
        const p95Latency = safeValue(item.latency.p95);
        const p99Latency = safeValue(item.latency.p99);
        const errorRate =
          totalRequests > 0
            ? (safeValue(item.errors) / totalRequests) * 100
            : 0;
        const requestsPerSecond = safeValue(item.requests.average);
        const throughputMB = safeValue(item.throughput.total) / 1024 / 1024;

        const isPeak = index === peakPerformance.index;

        return `
    <div class="scenario">
        <h3>测试场景 ${index + 1}: ${item.scenario} 
            ${isPeak ? '<span class="metric peak">🏆 最佳性能</span>' : ''}
        </h3>
        
        <div>
            <span class="metric">连接数: ${item.connections}</span>
            <span class="metric">持续时间: ${item.duration}秒</span>
            <span class="metric">请求总数: ${totalRequests.toLocaleString()}</span>
            ${item.timeouts > 0 ? `<span class="metric bad">超时: ${item.timeouts}</span>` : ''}
            ${item.errors > 0 ? `<span class="metric bad">错误: ${item.errors}</span>` : ''}
        </div>

        <table>
            <tr>
                <th>指标</th>
                <th>值</th>
                <th>状态</th>
            </tr>
            <tr>
                <td>请求/秒 (RPS)</td>
                <td>${requestsPerSecond.toFixed(2)}</td>
                <td><span class="metric ${requestsPerSecond > 10000 ? 'good' : requestsPerSecond > 5000 ? 'warning' : requestsPerSecond > 1000 ? 'bad' : 'bad'}">
                    ${requestsPerSecond > 10000 ? '极好' : requestsPerSecond > 5000 ? '良好' : requestsPerSecond > 1000 ? '一般' : '较差'}
                </span></td>
            </tr>
            <tr>
                <td>平均响应时间</td>
                <td>${avgLatency.toFixed(2)}ms</td>
                <td><span class="metric ${avgLatency < 10 ? 'good' : avgLatency < 50 ? 'warning' : 'bad'}">
                    ${avgLatency < 10 ? '极快' : avgLatency < 50 ? '快速' : '较慢'}
                </span></td>
            </tr>
            <tr>
                <td>95%响应时间</td>
                <td>${p95Latency.toFixed(2)}ms</td>
                <td><span class="metric ${p95Latency < 50 ? 'good' : p95Latency < 200 ? 'warning' : 'bad'}">
                    ${p95Latency < 50 ? '优秀' : p95Latency < 200 ? '良好' : '需优化'}
                </span></td>
            </tr>
            <tr>
                <td>吞吐量</td>
                <td>${throughputMB.toFixed(2)} MB</td>
                <td><span class="metric">数据传输量</span></td>
            </tr>
            <tr>
                <td>错误率</td>
                <td>${errorRate.toFixed(2)}%</td>
                <td><span class="metric ${errorRate < 0.1 ? 'good' : errorRate < 1 ? 'warning' : 'bad'}">
                    ${errorRate < 0.1 ? '优秀' : errorRate < 1 ? '可接受' : '需修复'}
                </span></td>
            </tr>
            <tr>
                <td>连接效率</td>
                <td>${(totalRequests / (item.connections * item.duration)).toFixed(2)}</td>
                <td><span class="metric">请求/连接/秒</span></td>
            </tr>
        </table>
    </div>
    `;
      })
      .join('')}

    ${
      this.results.length > 1
        ? `
    <div class="analysis">
        <h2>性能分析报告</h2>
        <h3>🏆 最佳性能场景</h3>
        ${
          peakPerformance.index >= 0
            ? `
        <p>在 <strong>${this.results[peakPerformance.index].scenario}</strong> 中获得最佳性能:</p>
        <ul>
            <li>并发数: ${this.results[peakPerformance.index].connections}</li>
            <li>峰值RPS: ${safeValue(this.results[peakPerformance.index].requests.average).toFixed(2)} 请求/秒</li>
            <li>平均延迟: ${safeValue(this.results[peakPerformance.index].latency.average).toFixed(2)}ms</li>
            <li>建议生产环境最大并发数: <strong>${Math.floor(this.results[peakPerformance.index].connections * 0.8)}</strong> (留出20%余量)</li>
        </ul>
        `
            : '<p>未找到明显的性能峰值</p>'
        }
        
        <h3>📈 性能趋势</h3>
        <p>随着并发数增加，性能变化如下:</p>
        <table>
            <tr><th>并发数</th><th>RPS</th><th>延迟</th><th>趋势</th></tr>
            ${this.results
              .map((item, index) => {
                const prev = index > 0 ? this.results[index - 1] : null;
                let trend = '';
                if (prev) {
                  const rpsChange =
                    ((item.requests.average - prev.requests.average) /
                      prev.requests.average) *
                    100;
                  if (rpsChange > 20) trend = '📈 显著提升';
                  else if (rpsChange > 0) trend = '↗️ 略有提升';
                  else if (rpsChange > -20) trend = '↘️ 略有下降';
                  else trend = '📉 显著下降';
                } else {
                  trend = '基准值';
                }

                return `
              <tr>
                <td>${item.connections}</td>
                <td>${safeValue(item.requests.average).toFixed(2)}</td>
                <td>${safeValue(item.latency.average).toFixed(2)}ms</td>
                <td>${trend}</td>
              </tr>`;
              })
              .join('')}
        </table>
        
        <h3>💡 优化建议</h3>
        <ul>
            <li><strong>生产环境设置:</strong> 建议最大并发数设置为 ${peakPerformance.index >= 0 ? Math.floor(this.results[peakPerformance.index].connections * 0.8) : 50}</li>
            <li><strong>监控指标:</strong> 重点关注95%响应时间和错误率</li>
            <li><strong>资源优化:</strong> 根据测试结果调整服务器资源配置</li>
            <li><strong>代码优化:</strong> 检查高并发下的性能瓶颈</li>
        </ul>
    </div>
    `
        : ''
    }
</body>
</html>`;

    await writeFile(reportPath, html);
    console.log(`📄 报告已生成: ${reportPath}`);
  }

  async generatePerformanceAnalysis() {
    if (this.results.length < 2) {
      console.log('⚠️  需要至少2个测试场景才能生成性能分析');
      return;
    }

    console.log('\n📈 详细性能分析报告:');
    console.log('='.repeat(70));

    // 找到性能峰值
    let peakRPS = 0;
    let peakIndex = -1;

    this.results.forEach((result, index) => {
      const rps = result.requests.average || 0;
      if (rps > peakRPS) {
        peakRPS = rps;
        peakIndex = index;
      }
    });

    if (peakIndex >= 0) {
      const peak = this.results[peakIndex];
      console.log(`🏆 最佳性能场景: ${peak.scenario}`);
      console.log(`   并发数: ${peak.connections}`);
      console.log(`   峰值RPS: ${peakRPS.toFixed(2)} 请求/秒`);
      console.log(`   平均延迟: ${(peak.latency.average || 0).toFixed(2)}ms`);
      console.log(`   95%延迟: ${(peak.latency.p95 || 0).toFixed(2)}ms`);
      console.log(`   请求总数: ${peak.requests.total.toLocaleString()}`);

      // 计算效率
      const efficiency =
        peak.requests.total / (peak.connections * peak.duration);
      console.log(`   连接效率: ${efficiency.toFixed(2)} 请求/连接/秒`);

      console.log(`\n💡 生产环境建议:`);
      console.log(
        `   最大并发数: ${Math.floor(peak.connections * 0.8)} (基于峰值80%)`,
      );
      console.log(`   预期RPS: ${Math.floor(peakRPS * 0.8)}`);
      console.log(
        `   预期延迟: ${(peak.latency.average * 1.2).toFixed(2)}ms (增加20%安全余量)`,
      );
    }

    console.log('\n📊 性能趋势分析:');
    for (let i = 1; i < this.results.length; i++) {
      const prev = this.results[i - 1];
      const curr = this.results[i];
      const prevRPS = prev.requests.average || 0;
      const currRPS = curr.requests.average || 0;
      const prevLatency = prev.latency.average || 0;
      const currLatency = curr.latency.average || 0;

      const rpsChange = ((currRPS - prevRPS) / prevRPS) * 100;
      const latencyChange = ((currLatency - prevLatency) / prevLatency) * 100;

      console.log(`   ${prev.scenario} → ${curr.scenario}:`);
      console.log(
        `     并发数: ${prev.connections} → ${curr.connections} (+${curr.connections - prev.connections})`,
      );
      console.log(
        `     RPS: ${prevRPS.toFixed(2)} → ${currRPS.toFixed(2)} (${rpsChange.toFixed(2)}%)`,
      );
      console.log(
        `     延迟: ${prevLatency.toFixed(2)}ms → ${currLatency.toFixed(2)}ms (${latencyChange.toFixed(2)}%)`,
      );

      if (rpsChange < -30 && currLatency > prevLatency * 3) {
        console.log(
          `     🚨 检测到性能拐点: RPS下降${Math.abs(rpsChange.toFixed(2))}%，延迟增加${latencyChange.toFixed(2)}%`,
        );
      }
    }

    console.log('='.repeat(70));
  }
}

// 运行测试
if (require.main === module) {
  const loadTest = new EnhancedLoadTest();
  loadTest.runLoadTest().catch(console.error);
}

module.exports = EnhancedLoadTest;
