import Router from 'koa-router';
import apiRoutes from '../../src/routes/api';

describe('API Routes Unit Tests', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    // 直接将路由挂载到新router上
    router.use('/api', apiRoutes.routes(), apiRoutes.allowedMethods());
  });

  describe('路由注册', () => {
    it('应该注册了根路由', () => {
      const route = router.stack.find(
        (layer) => layer.path === '/api' && layer.methods.includes('GET'),
      );
      expect(route).toBeDefined();
    });

    it('应该注册了健康检查路由', () => {
      const route = router.stack.find(
        (layer) =>
          layer.path === '/api/health' && layer.methods.includes('GET'),
      );
      expect(route).toBeDefined();
    });

    it('应该注册了状态路由', () => {
      const route = router.stack.find(
        (layer) =>
          layer.path === '/api/status' && layer.methods.includes('GET'),
      );
      expect(route).toBeDefined();
    });

    it('应该注册了回显路由', () => {
      const route = router.stack.find(
        (layer) =>
          layer.path === '/api/echo/:message' && layer.methods.includes('GET'),
      );
      expect(route).toBeDefined();
    });

    it('应该注册了POST回显路由', () => {
      const route = router.stack.find(
        (layer) => layer.path === '/api/echo' && layer.methods.includes('POST'),
      );
      expect(route).toBeDefined();
    });
  });

  describe('路由处理器', () => {
    it('GET /api 应该返回正确格式', async () => {
      const ctx: any = {
        body: null,
        params: {},
        query: {},
        request: { body: {} },
      };
      const next = jest.fn();

      // 找到对应的中间件并执行
      const route = router.stack.find(
        (layer) => layer.path === '/api' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        expect(ctx.body).toEqual({
          message: 'Hello from API!',
          timestamp: expect.any(String),
          version: '1.0.0',
        });
      } else {
        fail('路由未找到');
      }
    });

    it('GET /api/health 应该返回健康信息', async () => {
      const ctx: any = {
        body: null,
        params: {},
        query: {},
        request: { body: {} },
      };
      const next = jest.fn();

      const route = router.stack.find(
        (layer) =>
          layer.path === '/api/health' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        expect(ctx.body).toEqual({
          status: 'OK',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          cpu: expect.any(Array),
          environment: expect.any(String),
        });
      } else {
        fail('路由未找到');
      }
    });
  });

  describe('路由参数处理', () => {
    it('GET /api/echo/:message 应该处理路径参数', async () => {
      const ctx: any = {
        body: null,
        params: { message: 'test' },
        query: {},
        request: { body: {} },
      };
      const next = jest.fn();

      const route = router.stack.find(
        (layer) =>
          layer.path === '/api/echo/:message' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        expect(ctx.body).toEqual({
          original: 'test',
          repeated: 'test',
          length: 4,
          echoedAt: expect.any(String),
        });
      } else {
        fail('路由未找到');
      }
    });

    it('GET /api/echo/:message 应该处理查询参数', async () => {
      const ctx: any = {
        body: null,
        params: { message: 'hi' },
        query: { repeat: '3' },
        request: { body: {} },
      };
      const next = jest.fn();

      const route = router.stack.find(
        (layer) =>
          layer.path === '/api/echo/:message' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        expect(ctx.body).toEqual({
          original: 'hi',
          repeated: 'hihihi',
          length: 6,
          echoedAt: expect.any(String),
        });
      } else {
        fail('路由未找到');
      }
    });
  });

  describe('路由请求方法', () => {
    it('应该支持不同的HTTP方法', () => {
      const routes = router.stack.map((layer) => ({
        path: layer.path,
        methods: layer.methods,
      }));

      // 检查GET方法
      const getRoutes = routes.filter((route) => route.methods.includes('GET'));
      expect(getRoutes.length).toBeGreaterThan(0);

      // 检查POST方法
      const postRoutes = routes.filter((route) =>
        route.methods.includes('POST'),
      );
      expect(postRoutes.length).toBeGreaterThan(0);
    });
  });
});
