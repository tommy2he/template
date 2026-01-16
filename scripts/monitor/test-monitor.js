#!/usr/bin/env node
/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require('http');

// 生成一些测试流量
function generateTestTraffic() {
  console.log('生成测试流量...');

  const endpoints = [
    '/api/health',
    '/api/status',
    '/test/metrics',
    '/api/cpes/stats',
    '/api/devices',
  ];

  let requests = 0;
  const interval = setInterval(() => {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

    const req = http.request(
      {
        hostname: 'localhost',
        port: 7547,
        path: endpoint,
        method: 'GET',
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          requests++;
          if (requests % 10 === 0) {
            console.log(`已发送 ${requests} 个请求`);
          }
        });
      },
    );

    req.on('error', () => {});
    req.end();

    // 偶尔生成错误请求
    if (Math.random() < 0.1) {
      const errorReq = http.request({
        hostname: 'localhost',
        port: 7547,
        path: '/test/error',
        method: 'GET',
      });
      errorReq.on('error', () => {});
      errorReq.end();
    }
  }, 100); // 每100ms发送一个请求

  // 运行5分钟
  setTimeout(
    () => {
      clearInterval(interval);
      console.log('测试完成，查看Grafana仪表板查看监控数据');
    },
    5 * 60 * 1000,
  );
}

generateTestTraffic();
