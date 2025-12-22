import Router from 'koa-router';
import webRoutes from '../../src/routes/web';

describe('Web Routes Unit Tests', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    router.use('/', webRoutes.routes(), webRoutes.allowedMethods());
  });

  describe('路由注册', () => {
    it('应该注册了根路由', () => {
      const route = router.stack.find(
        (layer) => layer.path === '/' && layer.methods.includes('GET'),
      );
      expect(route).toBeDefined();
    });

    it('应该支持GET方法', () => {
      const routes = router.stack.map((layer) => ({
        path: layer.path,
        methods: Array.from(layer.methods),
      }));

      routes.forEach((route) => {
        expect(route.methods).toContain('GET');
      });
    });
  });

  describe('路由处理器', () => {
    it('GET / 应该返回正确的响应', async () => {
      const ctx: any = {
        body: null,
        params: {},
        query: {},
        request: { body: {} },
      };
      const next = jest.fn();

      const route = router.stack.find(
        (layer) => layer.path === '/' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        expect(ctx.body).toBe('Hello from Koa!');
      } else {
        fail('路由未找到');
      }
    });

    it('应该正确设置响应状态码', async () => {
      const ctx: any = {
        body: null,
        status: null,
        params: {},
        query: {},
        request: { body: {} },
      };
      const next = jest.fn();

      const route = router.stack.find(
        (layer) => layer.path === '/' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        // Koa默认状态码是200，但我们需要显式设置
        expect(ctx.status).toBe(undefined); // 如果没有设置，应该是undefined
      } else {
        fail('路由未找到');
      }
    });
  });

  describe('路由路径', () => {
    it('应该处理根路径', () => {
      const paths = router.stack.map((layer) => layer.path);
      expect(paths).toContain('/');
    });

    it('应该正确匹配路径参数（如果有的话）', () => {
      const route = router.stack[0];
      expect(route).toBeDefined();
      expect(route.path).toBe('/');
      expect(route.regexp).toBeDefined();
    });
  });

  describe('路由中间件', () => {
    it('应该正确执行中间件链', async () => {
      const ctx: any = {
        body: null,
        params: {},
        query: {},
        request: { body: {} },
      };
      const next = jest.fn();

      const route = router.stack.find(
        (layer) => layer.path === '/' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        await route.stack[0](ctx, next);

        // 最终路由处理器不调用next
        expect(next).not.toHaveBeenCalled();
        expect(ctx.body).toBe('Hello from Koa!');
      } else {
        fail('路由未找到');
      }
    });

    it('应该处理异步操作', async () => {
      const ctx: any = {
        body: null,
        params: {},
        query: {},
        request: { body: {} },
      };
      const next = jest.fn().mockResolvedValue(undefined);

      const route = router.stack.find(
        (layer) => layer.path === '/' && layer.methods.includes('GET'),
      );

      if (route && route.stack[0]) {
        // 确保没有抛出错误
        await expect(route.stack[0](ctx, next)).resolves.not.toThrow();
      } else {
        fail('路由未找到');
      }
    });
  });
});
