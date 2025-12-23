// test/middleware/rateLimit.test.ts
import Koa from 'koa';
import request from 'supertest';
import { Context } from 'koa';

// 正确导入：从 test/middleware 到 src/middleware 是两层上级
import { createBuiltInRateLimit } from '../../src/middleware/rateLimit';

describe('rateLimit Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    // 使用 createBuiltInRateLimit 创建速率限制中间件
    app.use(
      createBuiltInRateLimit({
        max: 5, // 测试用较小的限制
        windowMs: 60000,
        message: '测试速率限制',
      }),
    );

    app.use(async (ctx: Context) => {
      ctx.body = { message: 'Hello Rate Limit', count: 1 };
    });
  });

  it('应该允许正常请求', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello Rate Limit');
  });

  it('应该添加速率限制头信息', async () => {
    const response = await request(app.callback()).get('/');

    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('4');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('应该限制过多请求', async () => {
    const server = app.callback();

    // 前5个请求应该成功
    for (let i = 0; i < 5; i++) {
      const response = await request(server).get('/');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Hello Rate Limit');
    }

    // 第6个请求应该被限制
    const limitedResponse = await request(server).get('/');
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.message).toContain('测试速率限制');
    expect(limitedResponse.body.retryAfter).toBeDefined();
  });

  it('应该支持skip函数排除特定请求', async () => {
    // 创建一个新的应用，带skip功能
    const testApp = new Koa();

    testApp.use(
      createBuiltInRateLimit({
        max: 2,
        windowMs: 60000,
        message: '测试速率限制',
        skip: (ctx: Context) => ctx.path === '/health', // 健康检查跳过限流
      }),
    );

    testApp.use(async (ctx: Context) => {
      if (ctx.path === '/health') {
        ctx.body = { status: 'OK' };
      } else {
        ctx.body = { message: '其他端点' };
      }
    });

    const server = testApp.callback();

    // 健康检查端点不应被限制
    for (let i = 0; i < 10; i++) {
      const response = await request(server).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    }

    // 其他端点应该被限制
    await request(server).get('/other');
    await request(server).get('/other');
    const limitedResponse = await request(server).get('/other');
    expect(limitedResponse.status).toBe(429);
  });

  it('应该支持不同的IP地址', async () => {
    const server = app.callback();

    // 模拟不同IP的请求
    const ip1Response1 = await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.168.1.1');
    expect(ip1Response1.status).toBe(200);

    const ip2Response1 = await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.168.1.2');
    expect(ip2Response1.status).toBe(200);
  });

  it('应该正确清理过期记录', async () => {
    // 创建一个时间窗口很短的限流器
    const testApp = new Koa();
    testApp.use(
      createBuiltInRateLimit({
        max: 2,
        windowMs: 100, // 只有100ms
        message: '快速测试',
      }),
    );
    testApp.use(async (ctx: Context) => {
      ctx.body = { message: 'test' };
    });

    const server = testApp.callback();

    // 快速发送2个请求
    await request(server).get('/');
    await request(server).get('/');

    // 第3个应该被限制
    const response1 = await request(server).get('/');
    expect(response1.status).toBe(429);

    // 等待超过窗口时间
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 现在应该可以继续请求
    const response2 = await request(server).get('/');
    expect(response2.status).toBe(200);
  });
});
