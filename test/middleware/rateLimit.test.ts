import Koa from 'koa';
import request from 'supertest';
import rateLimit from '../../src/middleware/rateLimit';

describe('rateLimit Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    app.use(rateLimit());
    app.use(async (ctx) => {
      ctx.body = { message: 'Hello Rate Limit' };
    });
  });

  it('应该允许正常请求', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello Rate Limit');
  });

  it('应该添加速率限制头信息', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.headers['rate-limit-remaining']).toBeDefined();
    expect(response.headers['rate-limit-reset']).toBeDefined();
    expect(response.headers['rate-limit-total']).toBeDefined();
  });

  it('应该限制过多请求', async () => {
    // 模拟多次请求
    const server = app.callback();
    const requests = Array.from({ length: 150 }, () =>
      request(server).get('/'),
    );

    // 执行所有请求
    const responses = await Promise.all(requests);

    // 检查是否有被限制的请求
    const limitedResponse = responses.find((r) => r.status === 429);
    expect(limitedResponse).toBeDefined();

    if (limitedResponse) {
      expect(limitedResponse.body).toMatchObject({
        message: expect.stringContaining('请求过于频繁'),
      });
    }
  });

  it('应该支持白名单排除', async () => {
    const testApp = new Koa();
    testApp.use(rateLimit());

    // 健康检查端点通常应在白名单中
    testApp.use(async (ctx) => {
      if (ctx.path === '/health') {
        ctx.body = { status: 'OK' };
      } else {
        ctx.body = { message: '其他端点' };
      }
    });

    const server = testApp.callback();

    // 多次请求健康检查端点
    for (let i = 0; i < 150; i++) {
      const response = await request(server).get('/health');
      expect(response.status).toBe(200);
    }
  });
});
