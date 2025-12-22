import request from 'supertest';
import Koa from 'koa';
import Router from 'koa-router';
import serve from 'koa-static';
import path from 'path';
import middleware from '../../src/middleware';
import webRoutes from '../../src/routes/web';

describe('Web Routes Integration Tests', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();

    // 加载中间件
    middleware(app);

    // 设置路由
    const router = new Router();
    router.use('/', webRoutes.routes(), webRoutes.allowedMethods());
    app.use(router.routes()).use(router.allowedMethods());
  });

  describe('GET /', () => {
    it('应该返回欢迎页面', async () => {
      const response = await request(app.callback()).get('/').expect(200);

      expect(response.text).toBe('Hello from Koa!');
    });
  });

  describe('静态文件服务', () => {
    it('应该提供静态HTML文件', async () => {
      // 为测试临时添加静态文件中间件
      const testApp = new Koa();
      testApp.use(serve('public'));

      const response = await request(testApp.callback())
        .get('/index.html')
        .expect(200);

      expect(response.text).toContain('Koa Template App');
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('应该返回404对于不存在的静态文件', async () => {
      const testApp = new Koa();
      testApp.use(serve('public'));

      await request(testApp.callback()).get('/nonexistent.html').expect(404);
    });
  });

  describe('中间件集成', () => {
    it('应该记录请求日志', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await request(app.callback()).get('/').expect(200);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('应该设置CORS头', async () => {
      const response = await request(app.callback())
        .get('/')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });
  });
});
