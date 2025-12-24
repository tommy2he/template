import Koa from 'koa';
import request from 'supertest';
import errorHandler from '@/middleware/errorHandler';

// 模拟 console.error 避免测试输出干扰
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('errorHandler Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    app.use(errorHandler());
  });

  it('应该捕获并处理同步错误', async () => {
    app.use(async (ctx, next) => {
      throw new Error('测试错误');
    });

    const response = await request(app.callback()).get('/');

    expect(response.status).toBe(500);
    // 错误处理中间件会暴露错误信息
    expect(response.body).toEqual({ message: '测试错误' });
  });

  it('应该捕获并处理异步错误', async () => {
    app.use(async (ctx, next) => {
      await Promise.reject(new Error('异步错误'));
    });

    const response = await request(app.callback()).get('/');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('异步错误');
  });

  it('应该保留错误的状态码', async () => {
    app.use(async (ctx, next) => {
      const error = new Error('未授权');
      (error as any).status = 401;
      throw error;
    });

    const response = await request(app.callback()).get('/');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('未授权');
  });

  it('应该正确处理正常请求', async () => {
    app.use(async (ctx, next) => {
      ctx.body = { message: '成功' };
    });

    const response = await request(app.callback()).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: '成功' });
  });

  it('应该触发error事件', async () => {
    const mockError = new Error('测试错误');
    const errorListener = jest.fn();

    app.on('error', errorListener);

    app.use(async (ctx, next) => {
      throw mockError;
    });

    await request(app.callback()).get('/');

    expect(errorListener).toHaveBeenCalledWith(mockError, expect.any(Object));
  });
});
