import request from 'supertest';
import Koa from 'koa';
import Router from 'koa-router';
import middleware from '../../src/middleware';
import apiRoutes from '../../src/routes/api';

describe('API Integration Tests', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();

    // 加载中间件
    middleware(app);

    // 设置路由
    const router = new Router();
    router.use('/api', apiRoutes.routes(), apiRoutes.allowedMethods());
    app.use(router.routes()).use(router.allowedMethods());
  });

  describe('GET /api', () => {
    it('应该返回API欢迎信息', async () => {
      const response = await request(app.callback())
        .get('/api')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Hello from API!',
        timestamp: expect.any(String),
        version: '1.0.0',
      });
    });
  });

  describe('GET /api/health', () => {
    it('应该返回健康检查信息', async () => {
      const response = await request(app.callback())
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.any(Object),
        cpu: expect.any(Array),
        environment: expect.any(String),
      });
    });
  });

  describe('GET /api/status', () => {
    it('应该返回应用状态信息', async () => {
      const response = await request(app.callback())
        .get('/api/status')
        .expect(200);

      expect(response.body).toEqual({
        app: 'Koa Template App',
        version: '1.0.0',
        status: 'running',
        endpoints: expect.arrayContaining([
          '/api',
          '/api/health',
          '/api/status',
          '/api/echo/:message',
        ]),
      });
    });
  });

  describe('GET /api/echo/:message', () => {
    it('应该回显消息', async () => {
      const message = 'hello-world';
      const response = await request(app.callback())
        .get(`/api/echo/${message}`)
        .expect(200);

      expect(response.body).toEqual({
        original: message,
        repeated: message,
        length: message.length,
        echoedAt: expect.any(String),
      });
    });

    it('应该支持重复参数', async () => {
      const response = await request(app.callback())
        .get('/api/echo/test')
        .query({ repeat: 3 })
        .expect(200);

      expect(response.body.repeated).toBe('testtesttest');
      expect(response.body.length).toBe(12);
    });

    it('应该处理无效重复参数', async () => {
      const response = await request(app.callback())
        .get('/api/echo/test')
        .query({ repeat: 'not-a-number' })
        .expect(200);

      // 默认重复1次
      expect(response.body.repeated).toBe('test');
    });
  });

  describe('POST /api/echo', () => {
    it('应该处理POST请求并返回数据', async () => {
      const payload = {
        message: '测试消息',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const response = await request(app.callback())
        .post('/api/echo')
        .send(payload)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual({
        received: payload,
        processedAt: expect.any(String),
        serverInfo: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
        },
      });
    });

    it('应该为缺失的时间戳生成默认值', async () => {
      const response = await request(app.callback())
        .post('/api/echo')
        .send({ message: '测试' })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.received.timestamp).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理不存在的路由', async () => {
      const response = await request(app.callback())
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toEqual({ message: 'Not Found' });
    });

    it('应该处理CORS预检请求', async () => {
      const response = await request(app.callback())
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });
  });
});
