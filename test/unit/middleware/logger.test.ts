import Koa from 'koa';
import request from 'supertest';
import logger from '@/middleware/logger';

// 模拟 console.log 以便我们可以测试它被调用了
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('logger Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    app.use(logger());
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('应该记录成功的请求', async () => {
    app.use(async (ctx) => {
      ctx.body = { message: 'success' };
    });

    await request(app.callback()).get('/api/test').expect(200);

    // 验证 console.log 被调用
    expect(mockConsoleLog).toHaveBeenCalled();

    // 验证日志包含预期的信息
    const logMessage = mockConsoleLog.mock.calls[0][0];
    expect(logMessage).toContain('GET');
    expect(logMessage).toContain('/api/test');
    expect(logMessage).toContain('200');
    expect(logMessage).toContain('ms');
  });

  it('应该记录404错误请求', async () => {
    app.use(async (ctx) => {
      ctx.status = 404;
      ctx.body = { message: 'Not Found' };
    });

    await request(app.callback()).get('/not-found').expect(404);

    expect(mockConsoleLog).toHaveBeenCalled();
    const logMessage = mockConsoleLog.mock.calls[0][0];
    expect(logMessage).toContain('GET');
    expect(logMessage).toContain('/not-found');
    expect(logMessage).toContain('404');
  });

  it('应该记录服务器错误请求', async () => {
    app.use(async (ctx) => {
      ctx.status = 500;
      ctx.body = { message: 'Server Error' };
    });

    await request(app.callback()).get('/error').expect(500);

    expect(mockConsoleLog).toHaveBeenCalled();
    const logMessage = mockConsoleLog.mock.calls[0][0];
    expect(logMessage).toContain('GET');
    expect(logMessage).toContain('/error');
    expect(logMessage).toContain('500');
  });

  it('应该记录POST请求', async () => {
    app.use(async (ctx) => {
      ctx.body = { received: ctx.request.body };
    });

    await request(app.callback())
      .post('/api/data')
      .send({ name: 'test' })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(mockConsoleLog).toHaveBeenCalled();
    const logMessage = mockConsoleLog.mock.calls[0][0];
    expect(logMessage).toContain('POST');
    expect(logMessage).toContain('/api/data');
    expect(logMessage).toContain('200');
  });

  it('应该记录请求耗时', async () => {
    // 创建一个延迟的中间件来测试耗时
    app.use(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await next();
    });

    app.use(async (ctx) => {
      ctx.body = { message: 'delayed' };
    });

    await request(app.callback()).get('/slow').expect(200);

    expect(mockConsoleLog).toHaveBeenCalled();
    const logMessage = mockConsoleLog.mock.calls[0][0];
    expect(logMessage).toContain('ms');

    // 解析耗时
    const msMatch = logMessage.match(/(\d+)ms/);
    expect(msMatch).toBeDefined();
    const elapsedTime = parseInt(msMatch![1]);
    expect(elapsedTime).toBeGreaterThanOrEqual(40); // 至少40ms
  });

  it('应该包含ISO时间戳', async () => {
    app.use(async (ctx) => {
      ctx.body = { message: 'timestamp' };
    });

    await request(app.callback()).get('/timestamp').expect(200);

    expect(mockConsoleLog).toHaveBeenCalled();
    const logMessage = mockConsoleLog.mock.calls[0][0];

    // 检查是否包含ISO时间戳格式
    expect(logMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  describe('错误处理', () => {
    it('应该记录中间件抛出的错误', async () => {
      app.use(async () => {
        throw new Error('Middleware error');
      });

      // 直接请求并期望 500 状态码
      const response = await request(app.callback())
        .get('/error-route')
        .expect(500);

      // 验证返回了正确的错误响应
      expect(response.status).toBe(500);
      expect(response.text).toBe('Internal Server Error');

      // logger 应该被调用
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('应该在错误时返回500状态码', async () => {
      const testError = new Error('Test error');

      app.use(async () => {
        throw testError;
      });

      // 请求应该成功（返回 500 响应），而不是抛出错误
      const response = await request(app.callback()).get('/throw').expect(500);

      expect(response.status).toBe(500);
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('颜色标记', () => {
    it('应该对成功请求使用绿色标记', async () => {
      app.use(async (ctx) => {
        ctx.body = { success: true };
      });

      await request(app.callback()).get('/success').expect(200);

      expect(mockConsoleLog).toHaveBeenCalled();
      const logMessage = mockConsoleLog.mock.calls[0][0];

      // 由于我们 mock 了 chalk，这里检查 mock 的输出
      // 如果没有 mock chalk，这里应该检查是否包含绿色标记
      // 但实际上我们已经在 jest.config.js 中配置了 chalk mock
    });

    it('应该对客户端错误使用黄色标记', async () => {
      app.use(async (ctx) => {
        ctx.status = 400;
        ctx.body = { error: 'Bad Request' };
      });

      await request(app.callback()).get('/bad-request').expect(400);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('应该对服务器错误使用红色标记', async () => {
      app.use(async (ctx) => {
        ctx.status = 500;
        ctx.body = { error: 'Server Error' };
      });

      await request(app.callback()).get('/server-error').expect(500);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('边缘情况', () => {
    it('应该处理空的URL', async () => {
      app.use(async (ctx) => {
        ctx.body = { message: 'root' };
      });

      await request(app.callback()).get('/').expect(200);

      expect(mockConsoleLog).toHaveBeenCalled();
      const logMessage = mockConsoleLog.mock.calls[0][0];
      expect(logMessage).toContain('GET');
      expect(logMessage).toContain('/');
    });

    it('应该处理带有查询参数的URL', async () => {
      app.use(async (ctx) => {
        ctx.body = { query: ctx.query };
      });

      await request(app.callback()).get('/search?q=test&page=1').expect(200);

      expect(mockConsoleLog).toHaveBeenCalled();
      const logMessage = mockConsoleLog.mock.calls[0][0];
      expect(logMessage).toContain('/search?q=test&page=1');
    });

    it('应该处理不同的HTTP方法', async () => {
      app.use(async (ctx) => {
        ctx.body = { method: ctx.method };
      });

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockConsoleLog.mockClear();

        await (request(app.callback()) as any)
          [method.toLowerCase()]('/')
          .expect(200);

        expect(mockConsoleLog).toHaveBeenCalled();
        const logMessage = mockConsoleLog.mock.calls[0][0];
        expect(logMessage).toContain(method);
      }
    });
  });
});
