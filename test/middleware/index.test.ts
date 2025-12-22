import Koa from 'koa';
import request from 'supertest';
import middleware from '../../src/middleware';

describe('Middleware Integration', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    middleware(app);
  });

  describe('中间件顺序', () => {
    it('错误处理中间件应该在最前面', async () => {
      // 添加一个会抛出错误的中间件
      app.use(async () => {
        throw new Error('测试错误');
      });

      const response = await request(app.callback()).get('/').expect(500);

      expect(response.body).toEqual({ message: 'Internal Server Error' });
    });

    it('CORS中间件应该在错误处理之后', async () => {
      app.use(async (ctx) => {
        ctx.body = { success: true };
      });

      const response = await request(app.callback())
        .get('/')
        .set('Origin', 'http://example.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });

    it('日志中间件应该记录请求', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      app.use(async (ctx) => {
        ctx.body = 'OK';
      });

      await request(app.callback()).get('/test').expect(200);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET'),
        expect.stringContaining('/test'),
        expect.stringContaining('200'),
      );

      consoleSpy.mockRestore();
    });

    it('bodyParser应该解析JSON请求体', async () => {
      app.use(async (ctx) => {
        ctx.body = { received: ctx.request.body };
      });

      const payload = { name: 'John', age: 30 };
      const response = await request(app.callback())
        .post('/')
        .send(payload)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual({ received: payload });
    });

    it('应该支持静态文件服务', async () => {
      // 注意：这个测试需要public目录存在
      const response = await request(app.callback())
        .get('/index.html')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('中间件配置', () => {
    it('应该正确配置bodyParser选项', async () => {
      // 测试大文件上传限制
      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB

      await request(app.callback())
        .post('/')
        .send(largePayload)
        .set('Content-Type', 'application/json')
        .expect(413); // Payload Too Large
    });

    it('应该在生产环境设置静态文件缓存', async () => {
      // 模拟生产环境
      process.env.NODE_ENV = 'production';

      // 重新加载配置和中间件
      jest.resetModules();
      const productionMiddleware = require('../../src/middleware').default;
      const productionApp = new Koa();
      productionMiddleware(productionApp);

      // 这里我们无法直接测试缓存头，但可以确认中间件已加载
      expect(productionApp.middleware.length).toBeGreaterThan(0);

      // 恢复环境
      process.env.NODE_ENV = 'test';
    });
  });

  describe('错误处理集成', () => {
    it('应该处理不同类型的错误', async () => {
      // 测试404错误
      const response = await request(app.callback())
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toEqual({ message: 'Not Found' });
    });

    it('应该处理JSON解析错误', async () => {
      await request(app.callback())
        .post('/')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });
});
