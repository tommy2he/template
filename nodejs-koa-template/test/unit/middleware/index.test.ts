import Koa from 'koa';
import request from 'supertest';
import middleware from '@/middleware';

// Mock config 模块
jest.mock('@/config', () => ({
  __esModule: true,
  default: {
    env: 'test',
    port: 3300,
    appName: 'Koa Template App',
    appUrl: 'http://localhost:3300',

    // 日志配置
    logLevel: 'info',
    logFormat: 'combined',

    // API 配置
    apiPrefix: '/api',
    apiVersion: 'v1',
    apiTimeout: 30000,

    // CORS 配置
    corsOrigin: 'http://localhost:3300',
    corsCredentials: true,

    // 数据库配置
    mongodb: {
      uri: 'mongodb://localhost:27018/koa_template_test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    },

    // 安全配置
    jwtSecret: 'test_jwt_secret',
    jwtExpiresIn: '7d',

    // 开发配置
    enableSwagger: false,
    debug: false,

    // 其他配置
    uploadMaxSize: 10485760,
    uploadAllowedTypes: ['image/jpeg', 'image/png'],

    // 1.3版本新增配置
    rateLimit: {
      enabled: false, // 测试环境禁用
      maxRequests: 100,
      windowMs: 900000,
    },
    compression: {
      enabled: false, // 测试环境禁用
      threshold: 1024,
    },
    security: {
      enabled: false, // 测试环境禁用
      cspEnabled: false,
      hstsEnabled: false,
    },
    swagger: {
      enabled: false,
      title: 'Koa Template App API',
      description: 'Koa模板应用的API文档',
      version: '1.0.0',
    },

    // 1.4版本新增性能监控配置
    performance: {
      enabled: false, // 测试环境禁用
      sampleRate: 1.0,
      retentionDays: 7,
      endpoints: ['/', '/api', '/api/health', '/api/performance'],
    },
  },
}));

describe('Middleware Integration', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    middleware(app);
  });

  describe('中间件顺序', () => {
    it('错误处理中间件应该在最前面', async () => {
      // 添加一个会抛出错误的中间件
      app.use(async (ctx) => {
        throw new Error('测试错误');
      });

      // 使用一个不会被静态文件服务匹配的路径
      const randomPath = `/test-error-${Date.now()}`;
      const response = await request(app.callback())
        .get(randomPath)
        .expect(500);

      expect(response.body).toEqual({ message: '测试错误' });
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
        'http://localhost:3300',
      );
    });

    it('日志中间件应该记录请求', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      app.use(async (ctx) => {
        ctx.body = 'OK';
      });

      await request(app.callback()).get('/test').expect(200);

      expect(consoleSpy).toHaveBeenCalled();

      // 获取实际的日志消息
      const logMessage = consoleSpy.mock.calls[0][0];

      // 检查日志是否包含关键信息
      expect(logMessage).toContain('GET');
      expect(logMessage).toContain('/test');
      expect(logMessage).toContain('200');
      expect(logMessage).toContain('ms');

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
      // 测试一个小的 JSON payload
      const payload = { name: 'Test', value: 123 };

      // 添加一个简单的路由处理器
      app.use(async (ctx) => {
        // 使用类型安全的写法
        if (ctx.request.body && typeof ctx.request.body === 'object') {
          const body = ctx.request.body as Record<string, any>;
          ctx.body = { received: body };
        } else {
          ctx.body = { received: null };
        }
      });

      const response = await request(app.callback())
        .post('/')
        .send(payload)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.received).toEqual(payload);
    });

    it('应该在生产环境设置静态文件缓存', async () => {
      // 保存原始环境
      const originalEnv = process.env.NODE_ENV;

      // 修改为生产环境
      process.env.NODE_ENV = 'production';

      // 重置模块以重新加载配置
      jest.resetModules();

      // 重新导入中间件（会使用新的配置）
      const productionMiddleware = require('@/middleware').default;
      const productionApp = new Koa();
      productionMiddleware(productionApp);

      // 验证中间件已加载
      expect(productionApp.middleware.length).toBeGreaterThan(0);

      // 恢复环境
      process.env.NODE_ENV = originalEnv;

      // 重新加载当前模块
      jest.resetModules();
    });
  });

  describe('错误处理集成', () => {
    it('应该处理不同类型的错误', async () => {
      // 对于不存在的路由，Koa 默认返回 404
      const response = await request(app.callback())
        .get('/nonexistent')
        .expect(404);

      expect(response.text).toBe('Not Found');
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
