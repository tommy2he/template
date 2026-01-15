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

          const efficiency =
            report.requests.total / (scenario.connections * scenario.duration);
          console.log(`  连接效率: ${efficiency.toFixed(2)} 请求/连接/秒`);

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
    console.log('🚀 开始尖峰版负载测试 - 精确查找性能拐点');
    console.log(
      '📝 测试说明: 在100-150并发之间增加测试点，精确找到性能下降的转折点\n',
    );

    // 精确的测试场景，在100-150之间每10个并发一个测试点
    const testScenarios = [
      {
        name: '基线测试 (100并发)',
        connections: 100,
        duration: 40,
        requests: [
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '压力测试 (110并发)',
        connections: 110,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '压力测试 (120并发)',
        connections: 120,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '压力测试 (130并发)',
        connections: 130,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '压力测试 (140并发)',
        connections: 140,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '压力测试 (150并发)',
        connections: 150,
        duration: 40,
        requests: [
          { method: 'GET', path: '/' },
          { method: 'GET', path: '/api/health' },
          { method: 'GET', path: '/api/performance/health' },
        ],
      },
      {
        name: '极限测试 (160并发)',
        connections: 160,
        duration: 40,
        requests: [{ method: 'GET', path: '/api/health' }],
      },
      {
        name: '极限测试 (170并发)',
        connections: 170,
        duration: 40,
        requests: [{ method: 'GET', path: '/api/health' }],
      },
      {
        name: '极限测试 (180并发)',
        connections: 180,
        duration: 40,
        requests: [{ method: 'GET', path: '/api/health' }],
      },
      {
        name: '极限测试 (190并发)',
        connections: 190,
        duration: 40,
        requests: [{ method: 'GET', path: '/api/health' }],
      },
      {
        name: '极限测试 (200并发)',
        connections: 200,
        duration: 40,
        requests: [{ method: 'GET', path: '/api/health' }],
      },
    ];

    try {
      await this.startServer();

      console.log('\n⏳ 等待服务器稳定...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      let shouldStop = false;
      let performanceDeclineStart = null; // 记录性能开始下降的点

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

            // 记录性能开始下降的点
            if (
              !performanceDeclineStart &&
              currRPS < prevRPS * 0.9 && // RPS下降超过10%
              currLatency > prevLatency * 1.5
            ) {
              // 延迟增加超过50%
              performanceDeclineStart = prevResult;
              console.log(
                `📍 性能开始下降点: ${performanceDeclineStart.connections} 并发`,
              );
            }

            // 如果RPS下降超过30%且延迟增加超过200%，标记性能瓶颈
            if (currRPS < prevRPS * 0.7 && currLatency > prevLatency * 3) {
              console.log('🚨 检测到性能显著下降，可能已达到性能瓶颈！');
              console.log(
                `💡 建议: 最佳并发数可能在 ${performanceDeclineStart ? performanceDeclineStart.connections : prevResult.connections} 左右`,
              );
              this.performancePeak = performanceDeclineStart || prevResult;
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
            this.performancePeak = performanceDeclineStart || result;
            shouldStop = true;
          }

          if (
            !shouldStop &&
            scenario !== testScenarios[testScenarios.length - 1]
          ) {
            console.log('\n   💤 休息 3 秒，让服务器恢复...');
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
      console.log('\n🎉 尖峰版负载测试完成！');
    }
  }

  async generateReport() {
    const reportDir = path.join(__dirname, '../../reports/performance');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'peek-load-test-report.html');

    const safeValue = (value, defaultValue = 0) => {
      return value !== undefined && value !== null && !isNaN(value)
        ? value
        : defaultValue;
    };

    // 找到性能峰值
    let peakPerformance = { rps: 0, index: -1 };
    let performanceDeclineStart = { rps: 0, index: -1 };

    this.results.forEach((result, index) => {
      const rps = safeValue(result.requests.average);
      if (rps > peakPerformance.rps) {
        peakPerformance.rps = rps;
        peakPerformance.index = index;
      }
    });

    // 找到性能开始下降的点
    for (let i = 1; i < this.results.length; i++) {
      const prev = this.results[i - 1];
      const curr = this.results[i];
      const prevRPS = safeValue(prev.requests.average);
      const currRPS = safeValue(curr.requests.average);
      const prevLatency = safeValue(prev.latency.average);
      const currLatency = safeValue(curr.latency.average);

      if (currRPS < prevRPS * 0.9 && currLatency > prevLatency * 1.5) {
        performanceDeclineStart = { rps: prevRPS, index: i - 1 };
        break;
      }
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koa Template App - 性能拐点分析报告</title>
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
        .decline { background-color: #ffc107; color: #212529; }
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
        .rps-line {
            fill: none;
            stroke: #007bff;
            stroke-width: 2px;
        }
        .latency-line {
            fill: none;
            stroke: #dc3545;
            stroke-width: 2px;
        }
        .grid line {
            stroke: lightgrey;
            stroke-opacity: 0.7;
            shape-rendering: crispEdges;
        }
        .grid path {
            stroke-width: 0;
        }
    </style>
    <script src="https://d3js.org/d3.v6.min.js"></script>
</head>
<body>
    <div class="header">
        <h1>Koa Template App - 性能拐点分析报告</h1>
        <p>版本: 1.4.0 | 生成时间: ${new Date().toISOString()} | 测试端口: ${this.port}</p>
        ${
          peakPerformance.index >= 0
            ? `<p>🏆 峰值性能: ${this.results[peakPerformance.index].scenario} (${this.results[peakPerformance.index].connections} 并发)</p>`
            : ''
        }
        ${
          performanceDeclineStart.index >= 0
            ? `<p>📍 性能开始下降: ${this.results[performanceDeclineStart.index].scenario} (${this.results[performanceDeclineStart.index].connections} 并发)</p>`
            : ''
        }
    </div>

    <div class="summary">
        <h2>测试概览</h2>
        <p>测试场景数: ${this.results.length}</p>
        <p>测试并发范围: ${this.results[0]?.connections || 0} - ${this.results[this.results.length - 1]?.connections || 0}</p>
        <p>总请求数: ${this.results.reduce((sum, r) => sum + safeValue(r.requests.total), 0).toLocaleString()}</p>
        <p>总测试时长: ${this.results.reduce((sum, r) => sum + safeValue(r.duration), 0).toFixed(2)} 秒</p>
    </div>

    <div class="chart-container">
        <h2>性能趋势图</h2>
        <div id="chart" style="width: 100%; height: 400px;"></div>
        <div style="text-align: center; margin-top: 20px;">
            <span style="color: #007bff;">● RPS (请求/秒)</span>
            <span style="color: #dc3545; margin-left: 20px;">● 延迟 (ms)</span>
        </div>
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
        const isDeclineStart = index === performanceDeclineStart.index;

        return `
    <div class="scenario">
        <h3>测试场景 ${index + 1}: ${item.scenario} 
            ${isPeak ? '<span class="metric peak">🏆 峰值性能</span>' : ''}
            ${isDeclineStart ? '<span class="metric decline">📍 性能开始下降</span>' : ''}
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

    <div class="analysis">
        <h2>📊 性能拐点分析</h2>
        ${(() => {
          if (this.results.length < 2) {
            return '<p>需要至少2个测试场景才能进行拐点分析</p>';
          }

          let analysis = '<h3>🏆 性能峰值分析</h3>';

          if (peakPerformance.index >= 0) {
            const peak = this.results[peakPerformance.index];
            analysis += `
              <p>在 <strong>${peak.scenario}</strong> 场景中获得最高性能:</p>
              <ul>
                  <li>并发数: ${peak.connections}</li>
                  <li>峰值RPS: ${safeValue(peak.requests.average).toFixed(2)} 请求/秒</li>
                  <li>平均延迟: ${safeValue(peak.latency.average).toFixed(2)}ms</li>
                  <li>95%延迟: ${safeValue(peak.latency.p95).toFixed(2)}ms</li>
                  <li>请求总数: ${peak.requests.total.toLocaleString()}</li>
              </ul>`;
          }

          if (performanceDeclineStart.index >= 0) {
            const decline = this.results[performanceDeclineStart.index];
            const declineNext = this.results[performanceDeclineStart.index + 1];

            if (declineNext) {
              const rpsDecline = (
                ((declineNext.requests.average - decline.requests.average) /
                  decline.requests.average) *
                100
              ).toFixed(2);
              const latencyIncrease = (
                ((declineNext.latency.average - decline.latency.average) /
                  decline.latency.average) *
                100
              ).toFixed(2);

              analysis += `
                <h3>📍 性能下降转折点</h3>
                <p>在 ${decline.scenario} (${decline.connections} 并发) → ${declineNext.scenario} (${declineNext.connections} 并发) 之间检测到性能下降:</p>
                <ul>
                    <li>并发数增加: ${declineNext.connections - decline.connections}</li>
                    <li>RPS下降: ${Math.abs(parseFloat(rpsDecline))}%</li>
                    <li>延迟增加: ${latencyIncrease}%</li>
                    <li><strong>结论: 性能拐点出现在 ${decline.connections}-${declineNext.connections} 并发之间</strong></li>
                </ul>`;
            }
          }

          analysis += `
            <h3>💡 优化建议</h3>
            <ul>
                <li><strong>生产环境设置:</strong> 
                    ${
                      peakPerformance.index >= 0
                        ? `建议最大并发数设置为 ${Math.floor(this.results[peakPerformance.index].connections * 0.8)} (基于峰值80%)`
                        : '建议最大并发数设置为 50'
                    }
                </li>
                <li><strong>监控阈值:</strong> 当延迟超过 ${
                  performanceDeclineStart.index >= 0
                    ? safeValue(
                        this.results[performanceDeclineStart.index].latency
                          .average * 1.5,
                      ).toFixed(2)
                    : 50
                }ms 时发出警报</li>
                <li><strong>扩容策略:</strong> 当并发数接近 ${
                  performanceDeclineStart.index >= 0
                    ? this.results[performanceDeclineStart.index].connections
                    : 100
                } 时考虑水平扩展</li>
                <li><strong>代码优化:</strong> 检查 ${
                  performanceDeclineStart.index >= 0
                    ? this.results[performanceDeclineStart.index].connections
                    : 100
                }+ 并发下的性能瓶颈</li>
            </ul>`;

          return analysis;
        })()}
    </div>

    <script>
        // 使用D3.js绘制性能趋势图
        const data = ${JSON.stringify(
          this.results.map((r) => ({
            connections: r.connections,
            rps: r.requests.average || 0,
            latency: r.latency.average || 0,
            scenario: r.scenario,
          })),
        )};
        
        const margin = {top: 20, right: 80, bottom: 50, left: 60};
        const width = document.getElementById('chart').offsetWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        
        const svg = d3.select("#chart")
          .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        // 创建比例尺
        const x = d3.scaleLinear()
          .domain([d3.min(data, d => d.connections) * 0.9, d3.max(data, d => d.connections) * 1.1])
          .range([0, width]);
        
        // RPS比例尺（左Y轴）
        const yRps = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.rps) * 1.2])
          .range([height, 0]);
        
        // 延迟比例尺（右Y轴）
        const yLatency = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.latency) * 1.5])
          .range([height, 0]);
        
        // 添加网格
        svg.append("g")
          .attr("class", "grid")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x).tickSize(-height).tickFormat(""));
        
        svg.append("g")
          .attr("class", "grid")
          .call(d3.axisLeft(yRps).tickSize(-width).tickFormat(""));
        
        // 添加X轴
        svg.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x))
          .append("text")
            .attr("x", width / 2)
            .attr("y", 35)
            .attr("fill", "#000")
            .style("text-anchor", "middle")
            .text("并发连接数");
        
        // 添加左Y轴（RPS）
        svg.append("g")
          .call(d3.axisLeft(yRps))
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("x", -height / 2)
            .attr("fill", "#007bff")
            .style("text-anchor", "middle")
            .text("RPS (请求/秒)");
        
        // 添加右Y轴（延迟）
        svg.append("g")
          .attr("transform", "translate(" + width + ",0)")
          .call(d3.axisRight(yLatency))
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 50)
            .attr("x", -height / 2)
            .attr("fill", "#dc3545")
            .style("text-anchor", "middle")
            .text("延迟 (ms)");
        
        // 绘制RPS折线
        const rpsLine = d3.line()
          .x(d => x(d.connections))
          .y(d => yRps(d.rps))
          .curve(d3.curveMonotoneX);
        
        svg.append("path")
          .datum(data)
          .attr("class", "rps-line")
          .attr("d", rpsLine);
        
        // 绘制延迟折线
        const latencyLine = d3.line()
          .x(d => x(d.connections))
          .y(d => yLatency(d.latency))
          .curve(d3.curveMonotoneX);
        
        svg.append("path")
          .datum(data)
          .attr("class", "latency-line")
          .attr("d", latencyLine);
        
        // 添加数据点
        svg.selectAll(".rps-dot")
          .data(data)
          .enter().append("circle")
            .attr("class", "rps-dot")
            .attr("cx", d => x(d.connections))
            .attr("cy", d => yRps(d.rps))
            .attr("r", 4)
            .attr("fill", "#007bff")
            .append("title")
              .text(d => \`\${d.scenario}\\n并发: \${d.connections}\\nRPS: \${d.rps.toFixed(2)}\`);
        
        svg.selectAll(".latency-dot")
          .data(data)
          .enter().append("circle")
            .attr("class", "latency-dot")
            .attr("cx", d => x(d.connections))
            .attr("cy", d => yLatency(d.latency))
            .attr("r", 4)
            .attr("fill", "#dc3545")
            .append("title")
              .text(d => \`\${d.scenario}\\n并发: \${d.connections}\\n延迟: \${d.latency.toFixed(2)}ms\`);
        
        // 添加峰值标记
        const peakIndex = ${peakPerformance.index};
        if (peakIndex >= 0 && data[peakIndex]) {
          svg.append("circle")
            .attr("cx", x(data[peakIndex].connections))
            .attr("cy", yRps(data[peakIndex].rps))
            .attr("r", 8)
            .attr("fill", "none")
            .attr("stroke", "#007bff")
            .attr("stroke-width", 2);
        }
        
        // 添加性能下降点标记
        const declineIndex = ${performanceDeclineStart.index};
        if (declineIndex >= 0 && data[declineIndex]) {
          svg.append("circle")
            .attr("cx", x(data[declineIndex].connections))
            .attr("cy", yRps(data[declineIndex].rps))
            .attr("r", 8)
            .attr("fill", "none")
            .attr("stroke", "#ffc107")
            .attr("stroke-width", 2);
        }
    </script>
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

    console.log('\n📊 详细性能拐点分析:');
    console.log('='.repeat(80));

    // 找到性能峰值
    let peakRPS = 0;
    let peakIndex = -1;
    let declineStartIndex = -1;

    this.results.forEach((result, index) => {
      const rps = result.requests.average || 0;
      if (rps > peakRPS) {
        peakRPS = rps;
        peakIndex = index;
      }
    });

    // 找到性能开始下降的点
    for (let i = 1; i < this.results.length; i++) {
      const prev = this.results[i - 1];
      const curr = this.results[i];
      const prevRPS = prev.requests.average || 0;
      const currRPS = curr.requests.average || 0;
      const prevLatency = prev.latency.average || 0;
      const currLatency = curr.latency.average || 0;

      if (currRPS < prevRPS * 0.9 && currLatency > prevLatency * 1.5) {
        declineStartIndex = i - 1;
        break;
      }
    }

    // 输出详细分析
    if (peakIndex >= 0) {
      const peak = this.results[peakIndex];
      console.log(`🏆 峰值性能点:`);
      console.log(`   场景: ${peak.scenario}`);
      console.log(`   并发数: ${peak.connections}`);
      console.log(`   峰值RPS: ${peakRPS.toFixed(2)} 请求/秒`);
      console.log(`   平均延迟: ${(peak.latency.average || 0).toFixed(2)}ms`);
      console.log(`   95%延迟: ${(peak.latency.p95 || 0).toFixed(2)}ms`);
      console.log(
        `   连接效率: ${(peak.requests.total / (peak.connections * peak.duration)).toFixed(2)} 请求/连接/秒`,
      );
    }

    if (declineStartIndex >= 0 && declineStartIndex + 1 < this.results.length) {
      const decline = this.results[declineStartIndex];
      const declineNext = this.results[declineStartIndex + 1];
      const rpsDecline =
        ((declineNext.requests.average - decline.requests.average) /
          decline.requests.average) *
        100;
      const latencyIncrease =
        ((declineNext.latency.average - decline.latency.average) /
          decline.latency.average) *
        100;

      console.log(`\n📍 性能下降转折点:`);
      console.log(
        `   从 ${decline.scenario} (${decline.connections} 并发) 到 ${declineNext.scenario} (${declineNext.connections} 并发)`,
      );
      console.log(
        `   并发增加: ${declineNext.connections - decline.connections}`,
      );
      console.log(
        `   RPS下降: ${Math.abs(rpsDecline.toFixed(2))}% (${decline.requests.average.toFixed(2)} → ${declineNext.requests.average.toFixed(2)})`,
      );
      console.log(
        `   延迟增加: ${latencyIncrease.toFixed(2)}% (${decline.latency.average.toFixed(2)}ms → ${declineNext.latency.average.toFixed(2)}ms)`,
      );
      console.log(
        `   🔍 结论: 性能拐点在 ${decline.connections}-${declineNext.connections} 并发之间`,
      );
    }

    console.log('\n📈 详细性能数据表:');
    console.log('并发数 | RPS       | 延迟(ms)  | 95%延迟  | 效率      | 趋势');
    console.log('-' * 80);

    this.results.forEach((result, index) => {
      const rps = result.requests.average || 0;
      const latency = result.latency.average || 0;
      const p95 = result.latency.p95 || 0;
      const efficiency =
        result.requests.total / (result.connections * result.duration);

      let trend = '';
      if (index === peakIndex) trend = '🏆 峰值';
      else if (index === declineStartIndex) trend = '📍 开始下降';
      else if (index > 0) {
        const prevRPS = this.results[index - 1].requests.average || 0;
        if (rps > prevRPS) trend = '↑';
        else if (rps < prevRPS) trend = '↓';
        else trend = '→';
      }

      console.log(
        `${result.connections.toString().padEnd(6)} | ${rps.toFixed(2).padEnd(9)} | ${latency.toFixed(2).padEnd(9)} | ${p95.toFixed(2).padEnd(9)} | ${efficiency.toFixed(2).padEnd(9)} | ${trend}`,
      );
    });

    console.log('\n💡 优化建议:');
    if (declineStartIndex >= 0) {
      const safeConcurrency = Math.floor(
        this.results[declineStartIndex].connections * 0.8,
      );
      console.log(
        `   1. 生产环境建议最大并发数: ${safeConcurrency} (基于拐点 ${this.results[declineStartIndex].connections} 的80%)`,
      );
      console.log(
        `   2. 监控阈值: 延迟超过 ${(this.results[declineStartIndex].latency.average * 1.5).toFixed(2)}ms 时发出警报`,
      );
      console.log(
        `   3. 扩容时机: 当并发数接近 ${this.results[declineStartIndex].connections} 时考虑水平扩展`,
      );
    } else if (peakIndex >= 0) {
      const safeConcurrency = Math.floor(
        this.results[peakIndex].connections * 0.8,
      );
      console.log(
        `   1. 生产环境建议最大并发数: ${safeConcurrency} (基于峰值 ${this.results[peakIndex].connections} 的80%)`,
      );
    } else {
      console.log(`   1. 生产环境建议最大并发数: 50 (保守估计)`);
    }

    console.log('='.repeat(80));
  }
}

// 运行测试
if (require.main === module) {
  const loadTest = new EnhancedLoadTest();
  loadTest.runLoadTest().catch(console.error);
}

module.exports = EnhancedLoadTest;
