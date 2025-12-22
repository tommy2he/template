import Koa from 'koa';
import request from 'supertest';
import cors from '../../src/middleware/cors';

// 模拟 config 模块
jest.mock('../../src/config', () => ({
  default: {
    corsOrigin: 'http://localhost:3001', // 测试环境使用3001
    corsCredentials: true,
  },
}));

describe('cors Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    app.use(cors());
    app.use(async (ctx) => {
      ctx.body = { message: 'Hello CORS' };
    });
  });

  it('应该设置正确的CORS头', async () => {
    const response = await request(app.callback())
      .get('/')
      .set('Origin', 'http://example.com');

    // 注意：测试环境使用3001
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001',
    );
    expect(response.headers['access-control-allow-methods']).toBe(
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    expect(response.headers['access-control-allow-headers']).toBe(
      'Content-Type, Authorization, Accept',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('应该处理OPTIONS预检请求', async () => {
    const response = await request(app.callback())
      .options('/')
      .set('Origin', 'http://example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toBe(
      'GET, POST, PUT, DELETE, OPTIONS',
    );
  });

  it('应该允许跨域请求', async () => {
    const response = await request(app.callback())
      .get('/')
      .set('Origin', 'http://example.com');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello CORS');
  });

  it('应该支持跨域凭证', async () => {
    const response = await request(app.callback())
      .get('/')
      .set('Origin', 'http://example.com')
      .set('Cookie', 'sessionId=abc123');

    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
