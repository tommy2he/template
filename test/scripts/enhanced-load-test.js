#!/usr/bin/env node

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);

async function runLoadTest() {
  console.log('🚀 开始增强版负载测试...');

  const testScenarios = [
    {
      name: '低并发测试',
      connections: 10,
      duration: 30,
      requests: [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/api/health' },
        { method: 'GET', path: '/api/performance/health' },
      ],
    },
    {
      name: '中并发测试',
      connections: 50,
      duration: 60,
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
      duration: 90,
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
      duration: 120,
      requests: [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/api/health' },
        { method: 'GET', path: '/api/performance' },
      ],
    },
  ];

  const results = [];

  for (const scenario of testScenarios) {
    console.log(`\n📊 运行测试场景: ${scenario.name}`);
    console.log(
      `  连接数: ${scenario.connections}, 持续时间: ${scenario.duration}秒`,
    );

    const instance = autocannon({
      url: 'http://localhost:3000',
      connections: scenario.connections,
      duration: scenario.duration,
      requests: scenario.requests,
      headers: {
        'content-type': 'application/json',
      },
      timeout: 30,
      workers: 4,
      pipelining: 1,
      bailout: 100, // 错误率达到100%时停止
    });

    const result = await promisify(instance.on)('done');
    results.push({
      scenario: scenario.name,
      result: result,
    });

    console.log(`✅ ${scenario.name} 完成`);
    console.log(`  请求总数: ${result.requests.total}`);
    console.log(`  平均响应时间: ${result.latency.average}ms`);
    console.log(
      `  错误率: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`,
    );
  }

  // 生成HTML报告
  await generateReport(results);
  console.log('\n🎉 所有测试场景完成！');
}

async function generateReport(results) {
  const reportDir = path.join(__dirname, '../../reports/performance');

  // 确保目录存在
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'enhanced-load-test-report.html');

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
        <p>版本: 1.4.0 | 生成时间: ${new Date().toISOString()}</p>
    </div>

    <div class="summary">
        <h2>测试概览</h2>
        <p>总测试场景: ${results.length}</p>
        <p>总请求数: ${results.reduce((sum, r) => sum + r.result.requests.total, 0).toLocaleString()}</p>
        <p>总测试时长: ${results.reduce((sum, r) => sum + r.result.duration, 0).toFixed(2)} 秒</p>
    </div>

    ${results
      .map(
        (item, index) => `
    <div class="scenario">
        <h3>测试场景 ${index + 1}: ${item.scenario}</h3>
        
        <div>
            <span class="metric">连接数: ${item.result.connections}</span>
            <span class="metric">持续时间: ${item.result.duration}秒</span>
            <span class="metric">吞吐量: ${(item.result.throughput.total / 1024 / 1024).toFixed(2)} MB/s</span>
        </div>

        <table>
            <tr>
                <th>指标</th>
                <th>值</th>
                <th>状态</th>
            </tr>
            <tr>
                <td>总请求数</td>
                <td>${item.result.requests.total.toLocaleString()}</td>
                <td><span class="metric ${item.result.requests.total > 10000 ? 'good' : 'warning'}">${item.result.requests.total > 10000 ? '优秀' : '良好'}</span></td>
            </tr>
            <tr>
                <td>平均响应时间</td>
                <td>${item.result.latency.average.toFixed(2)}ms</td>
                <td><span class="metric ${item.result.latency.average < 50 ? 'good' : item.result.latency.average < 200 ? 'warning' : 'bad'}">${item.result.latency.average < 50 ? '快速' : item.result.latency.average < 200 ? '可接受' : '较慢'}</span></td>
            </tr>
            <tr>
                <td>95%响应时间</td>
                <td>${item.result.latency.p95.toFixed(2)}ms</td>
                <td><span class="metric ${item.result.latency.p95 < 100 ? 'good' : item.result.latency.p95 < 500 ? 'warning' : 'bad'}">${item.result.latency.p95 < 100 ? '优秀' : item.result.latency.p95 < 500 ? '良好' : '需优化'}</span></td>
            </tr>
            <tr>
                <td>99%响应时间</td>
                <td>${item.result.latency.p99.toFixed(2)}ms</td>
                <td><span class="metric ${item.result.latency.p99 < 200 ? 'good' : item.result.latency.p99 < 1000 ? 'warning' : 'bad'}">评估</span></td>
            </tr>
            <tr>
                <td>错误率</td>
                <td>${((item.result.errors / item.result.requests.total) * 100).toFixed(2)}%</td>
                <td><span class="metric ${item.result.errors / item.result.requests.total < 0.01 ? 'good' : item.result.errors / item.result.requests.total < 0.05 ? 'warning' : 'bad'}">${item.result.errors / item.result.requests.total < 0.01 ? '优秀' : item.result.errors / item.result.requests.total < 0.05 ? '可接受' : '需修复'}</span></td>
            </tr>
            <tr>
                <td>请求/秒</td>
                <td>${item.result.requests.average.toFixed(2)}</td>
                <td><span class="metric ${item.result.requests.average > 100 ? 'good' : item.result.requests.average > 50 ? 'warning' : 'bad'}">${item.result.requests.average > 100 ? '高' : item.result.requests.average > 50 ? '中' : '低'}</span></td>
            </tr>
        </table>

        <h4>延迟分布</h4>
        <table>
            <tr>
                <th>百分位</th>
                <th>2.5%</th>
                <th>50%</th>
                <th>97.5%</th>
                <th>99%</th>
            </tr>
            <tr>
                <td>响应时间 (ms)</td>
                <td>${item.result.latency.p2_5.toFixed(2)}</td>
                <td>${item.result.latency.p50.toFixed(2)}</td>
                <td>${item.result.latency.p97_5.toFixed(2)}</td>
                <td>${item.result.latency.p99.toFixed(2)}</td>
            </tr>
        </table>
    </div>
    `,
      )
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

// 运行测试
runLoadTest().catch(console.error);
