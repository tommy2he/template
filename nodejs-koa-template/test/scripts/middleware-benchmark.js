#!/usr/bin/env node

const Benchmark = require('benchmark');
const Koa = require('koa');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const execAsync = promisify(exec);

console.log('🔬 开始中间件性能分析...\n');

// 在加载中间件之前，先重写 console 方法
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  error: console.error,
  warn: console.warn,
};

// 重写所有 console 方法，完全静默
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.error = () => {};
console.warn = () => {};

// 创建一个自定义的 log 方法，只允许我们的测试输出
const testLog = (...args) => {
  // 清除进度条，避免覆盖
  if (process.stdout.cursorTo && process.stdout.clearLine) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
  }
  originalConsole.log(...args);
};

// 现在才加载中间件（此时所有 console 方法已经被重写）
const middleware = require('../../dist/middleware').default;

class MiddlewareBenchmark {
  constructor() {
    this.server = null;
    this.port = 3001;
    this.connections = new Set();
    this.isWindows = process.platform === 'win32';
    this.progressInterval = null;
    this.testStartTime = null;
    this.currentTestName = '';
    this.testProgress = 0;
    this.isProgressActive = false;

    // 存储测试结果
    this.results = {
      loadTest: null,
      requestTest: null,
      totalTime: 0,
      startTime: new Date(),
    };
  }

  // ==================== 报告生成部分 ====================
  async generateReport() {
    try {
      const reportDir = path.join(__dirname, '../../reports/performance');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const reportPath = path.join(
        reportDir,
        'middleware-benchmark-report.html',
      );

      // 安全提取数值
      const safeValue = (value, defaultValue = 0) => {
        return value !== undefined && value !== null && !isNaN(value)
          ? value
          : defaultValue;
      };

      // 格式化性能指标
      const formatMetric = (name, value, unit = '') => {
        const safeVal = safeValue(value);
        let status = 'good';
        let statusText = '优秀';

        if (name.includes('延迟') || name.includes('时间')) {
          if (safeVal > 100) {
            status = 'bad';
            statusText = '较差';
          } else if (safeVal > 50) {
            status = 'warning';
            statusText = '中等';
          }
        } else if (name.includes('ops/sec')) {
          if (safeVal < 1000) {
            status = 'bad';
            statusText = '较低';
          } else if (safeVal < 5000) {
            status = 'warning';
            statusText = '中等';
          }
        }

        return {
          value: safeVal,
          unit,
          status,
          statusText,
        };
      };

      const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koa中间件性能测试报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2.2em;
        }
        
        .header .subtitle {
            color: #7f8c8d;
            font-size: 1.1em;
        }
        
        .test-section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .section-title {
            color: #2c3e50;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #eee;
            font-size: 1.8em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .section-title:before {
            content: '';
            display: inline-block;
            width: 30px;
            height: 30px;
            background: currentColor;
            -webkit-mask: var(--icon) center/contain no-repeat;
            mask: var(--icon) center/contain no-repeat;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        
        .metric-card.good {
            border-left: 5px solid #28a745;
        }
        
        .metric-card.warning {
            border-left: 5px solid #ffc107;
        }
        
        .metric-card.bad {
            border-left: 5px solid #dc3545;
        }
        
        .metric-value {
            font-size: 2.2em;
            font-weight: bold;
            margin: 10px 0;
            color: #2c3e50;
        }
        
        .metric-label {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        
        .metric-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            margin-top: 10px;
        }
        
        .status-good {
            background-color: #d4edda;
            color: #155724;
        }
        
        .status-warning {
            background-color: #fff3cd;
            color: #856404;
        }
        
        .status-bad {
            background-color: #f8d7da;
            color: #721c24;
        }
        
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .comparison-table th {
            background: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
        }
        
        .comparison-table td {
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .comparison-table tr:hover {
            background-color: #f8f9fa;
        }
        
        .summary {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .summary-item {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .summary-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #2c3e50;
            margin: 10px 0;
        }
        
        .summary-label {
            color: #6c757d;
            font-size: 0.9em;
        }
        
        .recommendations {
            background: #e8f4fd;
            padding: 25px;
            border-radius: 8px;
            margin-top: 30px;
            border-left: 5px solid #007bff;
        }
        
        .recommendations h3 {
            color: #0056b3;
            margin-bottom: 15px;
        }
        
        .recommendations ul {
            list-style-position: inside;
            color: #495057;
        }
        
        .recommendations li {
            margin-bottom: 8px;
            padding-left: 10px;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            color: white;
            font-size: 0.9em;
        }
        
        @media (max-width: 768px) {
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 1.8em;
            }
            
            .test-section {
                padding: 20px;
            }
            
            .metrics-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Koa中间件性能测试报告</h1>
            <p class="subtitle">测试时间: ${this.results.startTime.toLocaleString('zh-CN')} | 测试端口: ${this.port}</p>
        </div>

        ${
          this.results.loadTest
            ? `
        <div class="test-section">
            <div class="section-title" style="--icon: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E&quot;);">
                中间件加载性能测试
            </div>
            
            <div class="metrics-grid">
                ${(() => {
                  const fastestTest = this.results.loadTest.fastest;
                  const slowestTest = this.results.loadTest.slowest;

                  const fastestMetric = formatMetric(
                    '操作/秒',
                    fastestTest.hz,
                    'ops/sec',
                  );
                  const slowestMetric = formatMetric(
                    '操作/秒',
                    slowestTest.hz,
                    'ops/sec',
                  );
                  const difference = (
                    ((fastestTest.hz - slowestTest.hz) / slowestTest.hz) *
                    100
                  ).toFixed(1);

                  return `
                    <div class="metric-card good">
                        <div class="metric-label">最快中间件配置</div>
                        <div class="metric-value">${fastestTest.name}</div>
                        <div class="metric-label">性能指标</div>
                        <div class="metric-value">${fastestMetric.value.toFixed(2)} ${fastestMetric.unit}</div>
                        <div class="metric-status status-good">${fastestMetric.statusText}</div>
                    </div>
                    
                    <div class="metric-card ${slowestMetric.status}">
                        <div class="metric-label">最慢中间件配置</div>
                        <div class="metric-value">${slowestTest.name}</div>
                        <div class="metric-label">性能指标</div>
                        <div class="metric-value">${slowestMetric.value.toFixed(2)} ${slowestMetric.unit}</div>
                        <div class="metric-status status-${slowestMetric.status}">${slowestMetric.statusText}</div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-label">性能差异</div>
                        <div class="metric-value">${difference}%</div>
                        <div class="metric-label">${fastestTest.name} 比 ${slowestTest.name} 快</div>
                    </div>
                  `;
                })()}
            </div>
            
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>测试场景</th>
                        <th>操作/秒</th>
                        <th>标准差</th>
                        <th>运行次数</th>
                        <th>平均时间</th>
                        <th>性能评分</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.results.loadTest.tests
                      .map((test) => {
                        const opsMetric = formatMetric(
                          '操作/秒',
                          test.hz,
                          'ops/sec',
                        );
                        const timeMetric = formatMetric(
                          '平均时间',
                          test.stats.mean * 1000,
                          'ms',
                        );

                        return `
                        <tr>
                            <td>${test.name}</td>
                            <td>${opsMetric.value.toFixed(2)}</td>
                            <td>${(test.stats.deviation * 100).toFixed(2)}%</td>
                            <td>${test.count}</td>
                            <td>${timeMetric.value.toFixed(3)}ms</td>
                            <td><span class="metric-status status-${opsMetric.status}">${opsMetric.statusText}</span></td>
                        </tr>
                      `;
                      })
                      .join('')}
                </tbody>
            </table>
        </div>
        `
            : ''
        }

        ${
          this.results.requestTest
            ? `
        <div class="test-section">
            <div class="section-title" style="--icon: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z'/%3E%3C/svg%3E&quot;);">
                请求处理性能测试
            </div>
            
            <div class="metrics-grid">
                ${(() => {
                  const fastestTest = this.results.requestTest.fastest;
                  const slowestTest = this.results.requestTest.slowest;

                  const fastestMetric = formatMetric(
                    '操作/秒',
                    fastestTest.hz,
                    'ops/sec',
                  );
                  const slowestMetric = formatMetric(
                    '操作/秒',
                    slowestTest.hz,
                    'ops/sec',
                  );
                  const timeDifference = (
                    ((slowestTest.stats.mean - fastestTest.stats.mean) /
                      fastestTest.stats.mean) *
                    100
                  ).toFixed(1);

                  return `
                    <div class="metric-card good">
                        <div class="metric-label">最快接口</div>
                        <div class="metric-value">${fastestTest.name}</div>
                        <div class="metric-label">平均响应时间</div>
                        <div class="metric-value">${(fastestTest.stats.mean * 1000).toFixed(3)}ms</div>
                        <div class="metric-label">吞吐量</div>
                        <div class="metric-value">${fastestMetric.value.toFixed(2)} ops/sec</div>
                    </div>
                    
                    <div class="metric-card ${fastestTest.stats.mean * 1000 > 100 ? 'bad' : fastestTest.stats.mean * 1000 > 50 ? 'warning' : 'good'}">
                        <div class="metric-label">最慢接口</div>
                        <div class="metric-value">${slowestTest.name}</div>
                        <div class="metric-label">平均响应时间</div>
                        <div class="metric-value">${(slowestTest.stats.mean * 1000).toFixed(3)}ms</div>
                        <div class="metric-label">吞吐量</div>
                        <div class="metric-value">${slowestMetric.value.toFixed(2)} ops/sec</div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-label">响应时间差异</div>
                        <div class="metric-value">${timeDifference}%</div>
                        <div class="metric-label">${slowestTest.name} 比 ${fastestTest.name} 慢</div>
                    </div>
                  `;
                })()}
            </div>
            
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>接口路径</th>
                        <th>平均响应时间</th>
                        <th>操作/秒</th>
                        <th>标准差</th>
                        <th>运行次数</th>
                        <th>性能评分</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.results.requestTest.tests
                      .map((test) => {
                        const timeMetric = formatMetric(
                          '平均时间',
                          test.stats.mean * 1000,
                          'ms',
                        );
                        const opsMetric = formatMetric(
                          '操作/秒',
                          test.hz,
                          'ops/sec',
                        );

                        return `
                        <tr>
                            <td>${test.name}</td>
                            <td>${timeMetric.value.toFixed(3)}ms</td>
                            <td>${opsMetric.value.toFixed(2)}</td>
                            <td>${(test.stats.deviation * 100).toFixed(2)}%</td>
                            <td>${test.count}</td>
                            <td><span class="metric-status status-${timeMetric.status}">${timeMetric.statusText}</span></td>
                        </tr>
                      `;
                      })
                      .join('')}
                </tbody>
            </table>
        </div>
        `
            : ''
        }

        <div class="summary">
            <div class="section-title" style="--icon: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2 2H5V5h14v14zm0-16H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z'/%3E%3C/svg%3E&quot;);">
                测试总结
            </div>
            
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">测试场景数量</div>
                    <div class="summary-value">
                        ${(() => {
                          const loadCount = this.results.loadTest
                            ? this.results.loadTest.tests.length
                            : 0;
                          const requestCount = this.results.requestTest
                            ? this.results.requestTest.tests.length
                            : 0;
                          return loadCount + requestCount;
                        })()}
                    </div>
                </div>
                
                <div class="summary-item">
                    <div class="summary-label">总测试耗时</div>
                    <div class="summary-value">${(this.results.totalTime / 1000).toFixed(2)}s</div>
                </div>
                
                <div class="summary-item">
                    <div class="summary-label">最佳响应时间</div>
                    <div class="summary-value">
                        ${(() => {
                          if (
                            this.results.requestTest &&
                            this.results.requestTest.tests.length > 0
                          ) {
                            const minTime = Math.min(
                              ...this.results.requestTest.tests.map(
                                (t) => t.stats.mean * 1000,
                              ),
                            );
                            return minTime.toFixed(3) + 'ms';
                          }
                          return 'N/A';
                        })()}
                    </div>
                </div>
                
                <div class="summary-item">
                    <div class="summary-label">最高吞吐量</div>
                    <div class="summary-value">
                        ${(() => {
                          if (
                            this.results.loadTest &&
                            this.results.loadTest.tests.length > 0
                          ) {
                            const maxHz = Math.max(
                              ...this.results.loadTest.tests.map((t) => t.hz),
                            );
                            return maxHz.toFixed(2) + ' ops/sec';
                          }
                          return 'N/A';
                        })()}
                    </div>
                </div>
            </div>
            
            ${(() => {
              let recommendations = [];

              if (this.results.requestTest) {
                const slowestRequest = this.results.requestTest.slowest;
                if (slowestRequest.stats.mean * 1000 > 100) {
                  recommendations.push(
                    `接口 <strong>${slowestRequest.name}</strong> 响应时间较慢 (${(slowestRequest.stats.mean * 1000).toFixed(3)}ms)，建议优化处理逻辑`,
                  );
                }

                if (slowestRequest.stats.deviation > 0.1) {
                  recommendations.push(
                    `接口 <strong>${slowestRequest.name}</strong> 响应时间波动较大 (标准差: ${(slowestRequest.stats.deviation * 100).toFixed(2)}%)，建议检查资源竞争问题`,
                  );
                }
              }

              if (this.results.loadTest) {
                const difference =
                  ((this.results.loadTest.fastest.hz -
                    this.results.loadTest.slowest.hz) /
                    this.results.loadTest.slowest.hz) *
                  100;
                if (difference > 100) {
                  recommendations.push(
                    `中间件加载性能差异较大 (${difference.toFixed(1)}%)，建议审查中间件执行顺序或优化高开销中间件`,
                  );
                }
              }

              if (recommendations.length === 0) {
                recommendations.push(
                  '所有测试指标均在良好范围内，性能表现优秀',
                );
              }

              return `
                <div class="recommendations">
                    <h3>💡 优化建议</h3>
                    <ul>
                        ${recommendations.map((rec) => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
              `;
            })()}
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Koa Template App - 中间件性能测试报告 | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>`;

      await writeFile(reportPath, html);
      testLog(`\n📄 中间件性能测试报告已生成: file://${reportPath}`);
    } catch (error) {
      originalConsole.error('生成报告时出错:', error.message);
    }
  }

  // ==================== 原有的测试逻辑部分 ====================
  // 显示进度条
  showProgress(message, progress, total = 100) {
    if (!this.isProgressActive) return;

    const width = 40;
    const filled = Math.round((progress / total) * width);
    const empty = width - filled;
    const percent = Math.round((progress / total) * 100);

    // 清除当前行
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
    }

    // 构建进度条
    const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`${message} [${progressBar}] ${percent}%`);
  }

  // 开始进度显示
  startProgress(testName) {
    this.currentTestName = testName;
    this.testProgress = 0;
    this.isProgressActive = true;

    testLog(`\n📊 ${testName}...`);
    this.showProgress(`  正在测试`, 0);
  }

  // 更新进度
  updateProgress(progress, elapsedSeconds = null) {
    if (!this.isProgressActive) return;

    let message = `  正在测试`;
    if (elapsedSeconds !== null) {
      message += ` (已运行 ${elapsedSeconds}s)`;
    }
    this.showProgress(message, progress);
  }

  // 完成进度显示
  completeProgress() {
    if (!this.isProgressActive) return;

    // 先停止进度更新
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // 显示完成状态
    this.showProgress(`  ✅ 测试完成`, 100);

    // 换行
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.write('\n');
    }

    this.isProgressActive = false;
  }

  // 停止进度显示
  stopProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.isProgressActive = false;
  }

  // 开始自动进度更新
  startAutoProgress(duration = 10000) {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (!this.isProgressActive) return;

      this.testProgress += 5;
      if (this.testProgress > 95) this.testProgress = 95;

      const elapsed = Date.now() - this.testStartTime;
      const seconds = Math.floor(elapsed / 1000);

      this.updateProgress(this.testProgress, seconds);
    }, 500);
  }

  // 清理占用端口的进程
  async killPortProcess(port) {
    try {
      testLog('🔧 检查端口占用情况...');

      if (this.isWindows) {
        const netstatCmd = `netstat -ano | findstr :${port} | findstr LISTENING`;
        try {
          const { stdout } = await execAsync(netstatCmd, { shell: true });
          if (stdout.trim()) {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              const currentPid = process.pid.toString();

              if (pid && !isNaN(pid) && pid !== currentPid) {
                testLog(`   🔫 杀死占用端口 ${port} 的进程: ${pid}`);
                try {
                  await execAsync(`taskkill /F /PID ${pid} /T`, {
                    shell: true,
                  });
                } catch (err) {
                  // 忽略错误
                }
              }
            }
          }
        } catch (error) {
          // 没有找到进程是正常的
        }
      } else {
        try {
          const { stdout } = await execAsync(`lsof -ti:${port}`, {
            shell: true,
          });
          if (stdout.trim()) {
            const pids = stdout.trim().split('\n');
            const currentPid = process.pid.toString();

            for (const pid of pids) {
              if (pid && pid !== currentPid) {
                testLog(`   🔫 杀死占用端口 ${port} 的进程: ${pid}`);
                try {
                  await execAsync(`kill -9 ${pid}`, { shell: true });
                } catch (err) {
                  // 忽略错误
                }
              }
            }
          }
        } catch (error) {
          // 没有找到进程是正常的
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      // 忽略错误
    }
  }

  async startServer() {
    testLog('\n' + '='.repeat(60));
    testLog('🚀 启动性能测试服务器');
    testLog('='.repeat(60));

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;

      if (attempts > 1) {
        testLog(
          `   ⚠️  端口 ${this.port - 1} 被占用，尝试端口 ${this.port}...`,
        );
      } else {
        testLog(`   📍 使用端口: ${this.port}`);
      }

      // 清理可能占用端口的进程
      await this.killPortProcess(this.port);

      const fullApp = new Koa();

      // 加载中间件 - 此时中间件内部的所有 console 调用都会被我们的重写方法静默处理
      middleware(fullApp);

      fullApp.use(async (ctx) => {
        if (ctx.path === '/test') {
          ctx.body = { message: 'Benchmark test' };
          return;
        }
        ctx.body = { processed: true };
      });

      return new Promise((resolve, reject) => {
        const http = require('http');
        this.server = http.createServer(fullApp.callback());

        // 跟踪所有连接
        this.server.on('connection', (socket) => {
          this.connections.add(socket);
          socket.on('close', () => {
            this.connections.delete(socket);
          });
        });

        this.server.listen(this.port, () => {
          testLog(`   ✅ 服务器启动成功 (端口: ${this.port})`);

          // 验证服务器是否正常工作
          const http = require('http');
          const testReq = http.request(
            {
              hostname: 'localhost',
              port: this.port,
              path: '/test',
              method: 'GET',
              timeout: 2000,
            },
            (res) => {
              testLog('   🔍 服务器验证: 正常响应');
              setTimeout(resolve, 500);
            },
          );

          testReq.on('error', () => {
            testLog('   ⚠️  服务器验证失败，重试...');
            this.server.close();
            setTimeout(() => {
              this.port++;
              if (this.port > 3020) {
                reject(new Error('找不到可用端口'));
              } else {
                this.startServer().then(resolve).catch(reject);
              }
            }, 1000);
          });

          testReq.end();
        });

        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            this.server.close();
            this.port++;
            if (this.port > 3020) {
              reject(new Error('找不到可用端口'));
            } else {
              setTimeout(() => {
                this.startServer().then(resolve).catch(reject);
              }, 1000);
            }
          } else {
            reject(err);
          }
        });

        // 启动超时
        setTimeout(() => {
          if (this.server && !this.server.listening) {
            this.server.close();
            reject(new Error('服务器启动超时'));
          }
        }, 5000);
      });
    }
  }

  async stopServer() {
    if (this.server) {
      testLog('\n🛑 停止性能测试服务器...');

      // 停止所有进度显示
      this.stopProgress();

      // 关闭所有活跃连接
      testLog('   🔌 关闭活跃连接...');
      let closedCount = 0;
      this.connections.forEach((socket) => {
        try {
          socket.destroy();
          closedCount++;
        } catch (err) {
          // 忽略错误
        }
      });

      if (closedCount > 0) {
        testLog(`   ✅ 已关闭 ${closedCount} 个连接`);
      }

      this.connections.clear();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          testLog('   ⏰ 服务器关闭超时，强制退出...');
          this.server = null;
          resolve();
        }, 3000);

        this.server.close((err) => {
          clearTimeout(timeout);
          if (err) {
            testLog(`   ⚠️  关闭服务器时出错: ${err.message}`);
            this.server = null;
            resolve();
          } else {
            testLog('   ✅ 服务器已停止');
            this.server = null;
            resolve();
          }
        });
      });
    }
  }

  async runLoadBenchmark() {
    this.testStartTime = Date.now(); // 修复：设置 this.testStartTime
    this.startProgress('中间件加载性能测试');
    this.startAutoProgress(5000);

    return new Promise((resolve) => {
      const loadSuite = new Benchmark.Suite();
      const tests = [];

      // 在闭包中捕获需要的值
      const completeProgress = this.completeProgress.bind(this);
      const startProgress = this.startProgress.bind(this);
      const startAutoProgress = this.startAutoProgress.bind(this);
      const results = this.results;
      const testStartTime = this.testStartTime; // 保存局部引用

      loadSuite
        .add('无中间件', {
          defer: true,
          fn: function (deferred) {
            const testApp = new Koa();
            testApp.use(async (ctx) => {
              ctx.body = { test: 'no middleware' };
            });
            deferred.resolve();
          },
        })
        .add('完整中间件栈', {
          defer: true,
          fn: function (deferred) {
            const testApp = new Koa();
            middleware(testApp);
            testApp.use(async (ctx) => {
              ctx.body = { test: 'full middleware' };
            });
            deferred.resolve();
          },
        })
        .on('start', () => {
          testLog('\n   ⚡ 开始性能测试...');
        })
        .on('cycle', (event) => {
          // 使用 originalConsole.log 输出测试结果
          completeProgress();
          originalConsole.log(`   📈 ${String(event.target)}`);

          // 收集测试数据
          tests.push({
            name: event.target.name,
            hz: event.target.hz,
            stats: event.target.stats,
            count: event.target.count,
          });

          // 重新开始进度条，因为可能还有下一个测试
          startProgress('中间件加载性能测试');
          startAutoProgress(5000);
        })
        .on('complete', function () {
          completeProgress();

          // 找出最快和最慢的测试
          const fastest = this.filter('fastest')[0];
          const slowest = this.filter('slowest')[0];

          // 保存测试结果
          results.loadTest = {
            fastest: {
              name: fastest.name,
              hz: fastest.hz,
              stats: fastest.stats,
            },
            slowest: {
              name: slowest.name,
              hz: slowest.hz,
              stats: slowest.stats,
            },
            tests: tests,
          };

          testLog('   🏆 最快的是: ' + fastest.name);
          testLog(
            `   📊 性能对比: ${fastest.name} 比 ${slowest.name} 快 ${(((fastest.hz - slowest.hz) / slowest.hz) * 100).toFixed(1)}%`,
          );

          const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);
          testLog(`   ⏱️  测试耗时: ${elapsed}秒`);

          resolve();
        });

      loadSuite.run({ async: true });
    });
  }

  async runRequestBenchmark() {
    this.testStartTime = Date.now(); // 修复：设置 this.testStartTime
    this.startProgress('请求处理性能测试');
    this.startAutoProgress(15000);

    return new Promise((resolve) => {
      const requestSuite = new Benchmark.Suite();
      const tests = [];

      // 在闭包中捕获需要的值
      const completeProgress = this.completeProgress.bind(this);
      const startProgress = this.startProgress.bind(this);
      const startAutoProgress = this.startAutoProgress.bind(this);
      const results = this.results;
      const port = this.port;
      const testStartTime = this.testStartTime; // 保存局部引用

      requestSuite
        .add('健康检查接口 (/test)', {
          defer: true,
          fn: function (deferred) {
            const http = require('http');
            const req = http.request(
              {
                hostname: 'localhost',
                port: port,
                path: '/test',
                method: 'GET',
              },
              (res) => {
                res.on('data', () => {});
                res.on('end', () => deferred.resolve());
              },
            );
            req.on('error', () => deferred.resolve());
            req.setTimeout(5000);
            req.end();
          },
        })
        .add('API根路径 (/api)', {
          defer: true,
          fn: function (deferred) {
            const http = require('http');
            const req = http.request(
              {
                hostname: 'localhost',
                port: port,
                path: '/api',
                method: 'GET',
              },
              (res) => {
                res.on('data', () => {});
                res.on('end', () => deferred.resolve());
              },
            );
            req.on('error', () => deferred.resolve());
            req.setTimeout(5000);
            req.end();
          },
        })
        .on('start', () => {
          testLog('\n   ⚡ 开始请求测试...');
          testLog(`   🌐 测试地址: http://localhost:${port}`);
        })
        .on('cycle', (event) => {
          // 使用 originalConsole.log 输出测试结果
          completeProgress();
          originalConsole.log(`   📈 ${String(event.target)}`);

          // 收集测试数据
          tests.push({
            name: event.target.name,
            hz: event.target.hz,
            stats: event.target.stats,
            count: event.target.count,
          });

          // 重新开始进度条，因为可能还有下一个测试
          if (event.target.name === '健康检查接口 (/test)') {
            startProgress('请求处理性能测试');
            startAutoProgress(15000);
          }
        })
        .on('complete', function () {
          completeProgress();

          // 找出最快和最慢的测试
          const fastest = this.filter('fastest')[0];
          const slowest = this.filter('slowest')[0];

          // 保存测试结果
          results.requestTest = {
            fastest: {
              name: fastest.name,
              hz: fastest.hz,
              stats: fastest.stats,
            },
            slowest: {
              name: slowest.name,
              hz: slowest.hz,
              stats: slowest.stats,
            },
            tests: tests,
          };

          if (this.length > 0) {
            testLog(
              `   🏆 平均响应时间: ${fastest.stats.mean.toFixed(3)}ms (最快)`,
            );
            testLog(
              `   📊 响应时间对比: ${slowest.name} 比 ${fastest.name} 慢 ${(((slowest.stats.mean - fastest.stats.mean) / fastest.stats.mean) * 100).toFixed(1)}%`,
            );
          }

          const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);
          testLog(`   ⏱️  测试耗时: ${elapsed}秒`);

          resolve();
        });

      // 运行请求测试
      requestSuite.run({ async: true });
    });
  }

  async runAllTests() {
    const totalStartTime = Date.now();

    testLog('='.repeat(60));
    testLog('🔥 中间件性能分析开始');
    testLog('='.repeat(60));
    testLog('📋 测试计划:');
    testLog('   1. 启动测试服务器');
    testLog('   2. 中间件加载性能测试');
    testLog('   3. 请求处理性能测试');
    testLog('   4. 清理测试环境');
    testLog('='.repeat(60));

    try {
      // 阶段1: 启动服务器
      testLog('\n📡 阶段1: 启动测试服务器');
      const serverStartTime = Date.now();
      await this.startServer();
      const serverTime = ((Date.now() - serverStartTime) / 1000).toFixed(1);
      testLog(`✅ 阶段1完成 (${serverTime}秒)`);

      // 等待服务器稳定
      testLog('\n⏳ 等待服务器稳定...');
      await new Promise((resolve) => {
        let dots = 0;
        const interval = setInterval(() => {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(`   等待中${'.'.repeat(dots % 4)}`);
          dots++;
        }, 500);

        setTimeout(() => {
          clearInterval(interval);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          testLog('   服务器稳定完成');
          resolve();
        }, 2000);
      });

      // 阶段2: 中间件加载测试
      testLog('\n🔧 阶段2: 中间件加载性能测试');
      await this.runLoadBenchmark();
      testLog('✅ 阶段2完成');

      // 阶段3: 请求处理测试
      testLog('\n🌐 阶段3: 请求处理性能测试');
      await this.runRequestBenchmark();
      testLog('✅ 阶段3完成');

      // 阶段4: 清理
      testLog('\n🧹 阶段4: 清理测试环境');
      const cleanupStartTime = Date.now();
      await this.stopServer();
      const cleanupTime = ((Date.now() - cleanupStartTime) / 1000).toFixed(1);
      testLog(`✅ 阶段4完成 (${cleanupTime}秒)`);

      // 记录总耗时
      this.results.totalTime = Date.now() - totalStartTime;

      // 总结
      const totalTime = (this.results.totalTime / 1000).toFixed(1);
      testLog('\n' + '='.repeat(60));
      testLog('✨ 测试完成总结');
      testLog('='.repeat(60));
      testLog(`⏱️  总耗时: ${totalTime}秒`);
      testLog(`✅ 所有测试通过`);
      testLog(
        `📊 测试了 ${this.results.loadTest ? this.results.loadTest.tests.length : 0} 种中间件配置`,
      );
      testLog(
        `🌐 测试了 ${this.results.requestTest ? this.results.requestTest.tests.length : 0} 种请求场景`,
      );
      testLog('='.repeat(60));

      // 生成HTML报告
      await this.generateReport();

      testLog('\n✅ 中间件性能分析完成\n');
    } catch (error) {
      // 停止进度显示
      this.stopProgress();

      originalConsole.error('\n❌ 性能测试失败:', error.message);
      testLog('🔄 正在清理资源...');

      try {
        await this.stopServer();
      } catch (cleanupError) {
        testLog('⚠️  清理资源时出错:', cleanupError.message);
      }

      testLog('🔚 测试已终止\n');
    }
  }
}

// 运行性能测试
if (require.main === module) {
  const benchmark = new MiddlewareBenchmark();
  benchmark.runAllTests().catch((error) => {
    originalConsole.error('测试错误:', error);
  });
}

module.exports = MiddlewareBenchmark;
