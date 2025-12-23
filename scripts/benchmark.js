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
      console.error(`   🔍 错误详情: ${error.stack}`);
      return null;
    }
  }

  // 运行混合请求测试 - 修复版本
  async runMixedBenchmark(baseUrl) {
    console.log('\n🧪 混合请求测试');
    console.log('   📊 80 连接, 25 秒');

    try {
      // 使用修复后的配置方式
      const instance = autocannon({
        url: `${baseUrl}/api/health`, // 主URL，但我们会覆盖请求
        title: '混合请求测试',
        connections: 80,
        duration: 25,
        pipelining: 1,
        requests: [
          {
            method: 'GET',
            path: '/api/health',
          },
          {
            method: 'GET',
            path: '/',
          },
        ],
      });

      // 监听结果
      instance.on('start', () => {
        console.log('   ▶️  开始混合请求测试...');
      });

      // 等待测试完成
      const result = await new Promise((resolve, reject) => {
        instance.on('done', (data) => {
          // 手动添加标题，因为autocannon可能不会自动添加
          data.title = '混合请求测试';
          resolve(data);
        });
        instance.on('error', reject);
      });

      console.log(`   ✅ 完成: ${result.requests.total} 请求`);
      console.log(`   📈 平均延迟: ${result.latency.average.toFixed(2)}ms`);
      console.log(`   ⚡ 请求/秒: ${result.requests.average.toFixed(2)}`);
      console.log(`   🔴 错误率: ${result.errors}%`);
      console.log(
        `   📤 吞吐量: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`,
      );

      this.results.push({
        name: '混合请求测试',
        ...result,
      });

      return result;
    } catch (error) {
      console.error(`   ❌ 混合请求测试失败: ${error.message}`);
      console.error(`   🔍 错误详情: ${error.stack}`);

      // 添加失败的结果记录
      this.results.push({
        name: '混合请求测试',
        error: error.message,
        status: 'failed',
      });

      return null;
    }
  }

  // 替代方案：简单的轮询测试
  async runSimpleMixedBenchmark(baseUrl) {
    console.log('\n🧪 简单混合请求测试');
    console.log('   📊 80 连接, 25 秒');

    try {
      // 使用两个单独的测试来模拟混合请求
      const healthResult = await autocannon({
        title: '混合请求-健康检查部分',
        url: `${baseUrl}/api/health`,
        connections: 40, // 一半连接给健康检查
        duration: 25,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const rootResult = await autocannon({
        title: '混合请求-根路径部分',
        url: `${baseUrl}/`,
        connections: 40, // 一半连接给根路径
        duration: 25,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // 合并结果
      const combinedResult = {
        name: '混合请求测试',
        requests: {
          total: healthResult.requests.total + rootResult.requests.total,
          average:
            (healthResult.requests.average + rootResult.requests.average) / 2,
        },
        latency: {
          average:
            (healthResult.latency.average + rootResult.latency.average) / 2,
          min: Math.min(healthResult.latency.min, rootResult.latency.min),
          max: Math.max(healthResult.latency.max, rootResult.latency.max),
          p99: (healthResult.latency.p99 + rootResult.latency.p99) / 2,
        },
        throughput: {
          total: healthResult.throughput.total + rootResult.throughput.total,
          average:
            (healthResult.throughput.average + rootResult.throughput.average) /
            2,
        },
        errors: (healthResult.errors + rootResult.errors) / 2,
        duration: 25,
        connections: 80,
      };

      console.log(
        `   ✅ 完成: ${combinedResult.requests.total.toLocaleString()} 请求`,
      );
      console.log(
        `   📈 平均延迟: ${combinedResult.latency.average.toFixed(2)}ms`,
      );
      console.log(
        `   ⚡ 请求/秒: ${combinedResult.requests.average.toFixed(2)}`,
      );
      console.log(`   🔴 错误率: ${combinedResult.errors.toFixed(2)}%`);
      console.log(
        `   📤 吞吐量: ${(combinedResult.throughput.total / 1024 / 1024).toFixed(2)} MB`,
      );

      this.results.push(combinedResult);

      return combinedResult;
    } catch (error) {
      console.error(`   ❌ 混合请求测试失败: ${error.message}`);
      console.error(`   🔍 错误详情: ${error.stack}`);

      // 添加失败的结果记录
      this.results.push({
        name: '混合请求测试',
        error: error.message,
        status: 'failed',
      });

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

      // 测试场景4: 混合请求测试 - 使用简单版本
      await this.runSimpleMixedBenchmark(baseUrl);

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
      console.error('🔍 错误详情:', error.stack);
    } finally {
      // 停止服务器
      await this.stopServer();
      console.log('\n✅ 基准测试完成');
      process.exit(0);
    }
  }

  // 生成HTML报告
  async generateHtmlReport(results, summary) {
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
        .chart-container { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .chart-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .chart-item { flex: 1; margin: 0 10px; }
        .chart-title { font-weight: bold; margin-bottom: 10px; }
        .chart-bar { height: 20px; background: #4a6fa5; border-radius: 3px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
        .metric-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .metric-label { color: #666; font-size: 0.9em; }
        .performance-rating { 
            padding: 15px; 
            border-radius: 8px; 
            margin: 10px 0; 
            font-weight: bold;
        }
        .rating-excellent { background: #e8f5e9; color: #2e7d32; border-left: 5px solid #2e7d32; }
        .rating-good { background: #fff3e0; color: #ef6c00; border-left: 5px solid #ef6c00; }
        .rating-poor { background: #ffebee; color: #c62828; border-left: 5px solid #c62828; }
        .failed-test { 
            background: #ffebee; 
            color: #c62828; 
            border: 1px solid #c62828; 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Koa Template App 性能测试报告</h1>
        <p>生成时间: ${new Date().toLocaleString()}</p>
        <p>测试端口: ${this.port}</p>
        <p>测试场景: ${results.length} 项 (${results.filter((r) => !r.status || r.status !== 'failed').length} 项成功)</p>
    </div>
    
    <div class="summary">
        <h2>📊 测试摘要</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">总请求数</div>
                <div class="metric-value">${summary.totalRequests.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">总错误数</div>
                <div class="metric-value ${summary.totalErrors === 0 ? 'good' : 'bad'}">${summary.totalErrors}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">平均延迟</div>
                <div class="metric-value">${summary.avgLatency.toFixed(2)}ms</div>
                <div class="performance-rating ${this.getLatencyRating(summary.avgLatency)}">
                    ${this.getLatencyRatingText(summary.avgLatency)}
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">平均吞吐量</div>
                <div class="metric-value">${(summary.avgThroughput / 1024 / 1024).toFixed(2)} MB/秒</div>
            </div>
        </div>
    </div>
    
    <h2>📈 详细结果</h2>
    <table>
        <thead>
            <tr>
                <th>测试场景</th>
                <th>状态</th>
                <th>请求数</th>
                <th>平均延迟</th>
                <th>请求/秒</th>
                <th>错误率</th>
                <th>吞吐量</th>
                <th>性能评级</th>
            </tr>
        </thead>
        <tbody>
            ${results
              .map((r) => {
                if (r.status === 'failed') {
                  return `
            <tr>
                <td>${r.name}</td>
                <td><span class="bad">失败</span></td>
                <td colspan="6" class="failed-test">${r.error || '测试执行失败'}</td>
            </tr>
            `;
                } else {
                  return `
            <tr>
                <td>${r.name}</td>
                <td><span class="good">成功</span></td>
                <td>${r.requests ? r.requests.total.toLocaleString() : 'N/A'}</td>
                <td class="${r.latency ? (r.latency.average < 50 ? 'good' : r.latency.average < 200 ? 'warning' : 'bad') : 'bad'}">
                    ${r.latency ? r.latency.average.toFixed(2) + 'ms' : 'N/A'}
                </td>
                <td>${r.requests ? r.requests.average.toFixed(2) : 'N/A'}</td>
                <td class="${r.errors === 0 ? 'good' : 'bad'}">${r.errors !== undefined ? r.errors.toFixed(2) + '%' : 'N/A'}</td>
                <td>${r.throughput ? (r.throughput.total / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</td>
                <td>
                    ${
                      r.latency
                        ? `
                    <div class="performance-rating ${this.getLatencyRating(r.latency.average)}">
                        ${this.getLatencyRatingText(r.latency.average)}
                    </div>`
                        : 'N/A'
                    }
                </td>
            </tr>
            `;
                }
              })
              .join('')}
        </tbody>
    </table>
    
    <!-- 可视化图表区域 -->
    ${
      results.filter((r) => r.latency && r.throughput && r.status !== 'failed')
        .length > 0
        ? `
    <div class="chart-container">
        <h2>📊 性能可视化</h2>
        <div class="chart-row">
            <div class="chart-item">
                <div class="chart-title">延迟对比</div>
                ${this.generateLatencyChart(results.filter((r) => r.latency && r.status !== 'failed'))}
            </div>
            <div class="chart-item">
                <div class="chart-title">吞吐量对比</div>
                ${this.generateThroughputChart(results.filter((r) => r.throughput && r.status !== 'failed'))}
            </div>
        </div>
    </div>`
        : ''
    }
    
    <div style="margin-top: 30px; color: #666; font-size: 0.9em;">
        <h3>性能评级标准:</h3>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="performance-rating rating-excellent">优秀</div>
                <p>延迟 &lt; 50ms</p>
                <p>错误率 = 0%</p>
            </div>
            <div class="metric-card">
                <div class="performance-rating rating-good">良好</div>
                <p>延迟 50-200ms</p>
                <p>错误率 &lt; 1%</p>
            </div>
            <div class="metric-card">
                <div class="performance-rating rating-poor">需要优化</div>
                <p>延迟 &gt; 200ms</p>
                <p>错误率 &gt; 1%</p>
            </div>
        </div>
    </div>
</body>
</html>`;

    const reportPath = path.join(__dirname, '../performance-report.html');
    await writeFile(reportPath, report);
    return reportPath;
  }

  // 生成延迟图表
  generateLatencyChart(results) {
    const validResults = results.filter((r) => r.latency);
    if (validResults.length === 0) return '<p>无可用数据</p>';

    const maxLatency = Math.max(...validResults.map((r) => r.latency.average));
    let chartHtml = '';

    validResults.forEach((result) => {
      const width =
        maxLatency > 0
          ? (result.latency.average / maxLatency) * 100 + '%'
          : '0%';
      const color =
        result.latency.average < 50
          ? '#4CAF50'
          : result.latency.average < 200
            ? '#FF9800'
            : '#F44336';

      chartHtml += `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between;">
            <span>${result.name}</span>
            <span>${result.latency.average.toFixed(2)}ms</span>
          </div>
          <div style="height: 20px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
            <div style="width: ${width}; height: 100%; background: ${color};"></div>
          </div>
        </div>
      `;
    });

    return chartHtml;
  }

  // 生成吞吐量图表
  generateThroughputChart(results) {
    const validResults = results.filter((r) => r.throughput);
    if (validResults.length === 0) return '<p>无可用数据</p>';

    const maxThroughput = Math.max(
      ...validResults.map((r) => r.throughput.average),
    );
    let chartHtml = '';

    validResults.forEach((result) => {
      const throughputMB = result.throughput.average / 1024 / 1024;
      const maxThroughputMB = maxThroughput / 1024 / 1024;
      const width =
        maxThroughputMB > 0
          ? (throughputMB / maxThroughputMB) * 100 + '%'
          : '0%';

      chartHtml += `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between;">
            <span>${result.name}</span>
            <span>${throughputMB.toFixed(2)} MB/s</span>
          </div>
          <div style="height: 20px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
            <div style="width: ${width}; height: 100%; background: #2196F3;"></div>
          </div>
        </div>
      `;
    });

    return chartHtml;
  }

  // 获取延迟评级
  getLatencyRating(latency) {
    if (latency < 50) return 'rating-excellent';
    if (latency < 200) return 'rating-good';
    return 'rating-poor';
  }

  // 获取延迟评级文本
  getLatencyRatingText(latency) {
    if (latency < 50) return '优秀';
    if (latency < 200) return '良好';
    return '需要优化';
  }

  async generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 性能测试报告');
    console.log('='.repeat(50));

    const validResults = this.results.filter(
      (r) => r.requests && r.latency && (!r.status || r.status !== 'failed'),
    );
    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      avgLatency: 0,
      avgThroughput: 0,
      avgRPS: 0,
    };

    validResults.forEach((result) => {
      summary.totalRequests += result.requests.total;
      summary.totalErrors += result.errors;
      summary.avgLatency += result.latency.average;
      summary.avgThroughput += result.throughput.average;
      summary.avgRPS += result.requests.average;
    });

    const count = validResults.length;
    if (count > 0) {
      summary.avgLatency /= count;
      summary.avgThroughput /= count;
      summary.avgRPS /= count;
    }

    console.log(`📈 总请求数: ${summary.totalRequests.toLocaleString()}`);
    console.log(`⚠️  总错误数: ${summary.totalErrors}`);
    console.log(`⏱️  平均延迟: ${summary.avgLatency.toFixed(2)}ms`);
    console.log(`⚡ 平均请求/秒: ${summary.avgRPS.toFixed(2)}`);
    console.log(
      `📤 平均吞吐量: ${(summary.avgThroughput / 1024 / 1024).toFixed(2)} MB/秒`,
    );

    // 统计成功和失败的测试
    const successfulTests = this.results.filter(
      (r) => !r.status || r.status !== 'failed',
    ).length;
    const failedTests = this.results.filter(
      (r) => r.status === 'failed',
    ).length;
    console.log(`✅ 成功测试: ${successfulTests} 项`);
    if (failedTests > 0) {
      console.log(`❌ 失败测试: ${failedTests} 项`);
    }

    // 生成HTML报告
    const reportPath = await this.generateHtmlReport(this.results, summary);
    console.log(`\n📄 详细报告已生成: file://${reportPath}`);

    // 同时生成JSON格式的报告
    await this.generateJsonReport(this.results, summary);
  }

  // 生成JSON报告
  async generateJsonReport(results, summary) {
    const jsonReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        port: this.port,
        totalTestScenarios: results.length,
        successfulScenarios: results.filter(
          (r) => !r.status || r.status !== 'failed',
        ).length,
        failedScenarios: results.filter((r) => r.status === 'failed').length,
      },
      summary: {
        ...summary,
        avgLatency: summary.avgLatency,
        avgThroughputMB: summary.avgThroughput / 1024 / 1024,
      },
      detailedResults: results.map((result) => {
        if (result.status === 'failed') {
          return {
            name: result.name,
            status: 'failed',
            error: result.error || 'Unknown error',
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            name: result.name,
            status: 'success',
            requests: result.requests
              ? {
                  total: result.requests.total,
                  average: result.requests.average,
                }
              : null,
            latency: result.latency
              ? {
                  average: result.latency.average,
                  min: result.latency.min,
                  max: result.latency.max,
                  p99: result.latency.p99,
                }
              : null,
            throughput: result.throughput
              ? {
                  total: result.throughput.total,
                  average: result.throughput.average,
                  averageMB: result.throughput.average / 1024 / 1024,
                }
              : null,
            errors: result.errors || 0,
            duration: result.duration || 0,
            connections: result.connections || 0,
            performanceRating: result.latency
              ? this.getLatencyRatingText(result.latency.average)
              : 'N/A',
            timestamp: new Date().toISOString(),
          };
        }
      }),
    };

    const jsonPath = path.join(__dirname, '../performance-report.json');
    await writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
    console.log(`📋 JSON报告已生成: ${jsonPath}`);
  }
}

// 运行基准测试
if (require.main === module) {
  const benchmark = new Benchmark();
  benchmark.runComprehensiveBenchmark().catch(console.error);
}

module.exports = Benchmark;
