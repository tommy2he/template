import Koa from 'koa';
import request from 'supertest';
import security from '../../src/middleware/security';

describe('security Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    app.use(security());
    app.use(async (ctx) => {
      ctx.body = { message: 'Hello Secure App' };
    });
  });

  it('应该设置基本安全头', async () => {
    const response = await request(app.callback()).get('/');

    // 检查关键安全头
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBeDefined();
    expect(response.headers['permissions-policy']).toBeDefined();
  });

  it('应该隐藏X-Powered-By头', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('应该设置内容安全策略', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('应该防止点击劫持', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('应该防止MIME类型嗅探', async () => {
    const response = await request(app.callback()).get('/');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
