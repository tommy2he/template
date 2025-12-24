#!/usr/bin/env node

const Benchmark = require('benchmark');
const Koa = require('koa');
const middleware = require('../../dist/middleware').default;

console.log('🔬 开始中间件性能分析...');

// 创建测试应用
const app = new Koa();

// 添加测试路由
app.use(async (ctx, next) => {
  if (ctx.path === '/test') {
    ctx.body = { message: 'Benchmark test' };
    return;
  }
  await next();
});

// 测量中间件加载时间
console.log('\n📊 测量中间件加载时间:');
const loadSuite = new Benchmark.Suite();

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
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('🏆 最快的是: ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });

// 测量请求处理时间
setTimeout(() => {
  console.log('\n📊 测量请求处理时间:');
  const requestSuite = new Benchmark.Suite();

  const fullApp = new Koa();
  middleware(fullApp);
  fullApp.use(async (ctx) => {
    ctx.body = { processed: true };
  });

  const server = require('http').createServer(fullApp.callback());

  requestSuite
    .add('简单GET请求', {
      defer: true,
      fn: function (deferred) {
        const http = require('http');
        const req = http.request(
          {
            hostname: 'localhost',
            port: 3001,
            path: '/test',
            method: 'GET',
          },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => deferred.resolve());
          },
        );
        req.end();
      },
    })
    .on('cycle', function (event) {
      console.log(String(event.target));
    })
    .on('complete', function () {
      console.log('🏆 平均响应时间: ' + this[0].stats.mean.toFixed(3) + 'ms');
      server.close();
    });

  // 启动测试服务器
  server.listen(3001, () => {
    requestSuite.run({ async: true });
  });
}, 2000);
