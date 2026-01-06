// 清除缓存，确保每次测试都重新加载配置
beforeEach(() => {
  jest.resetModules();
});

describe('Configuration Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('应该使用默认配置', () => {
    // 清除环境变量
    process.env = {};

    // 重新加载配置模块
    const configModule = require('../../../src/config');
    const config = configModule.default;
    const { isDevelopment, isProduction, isTest } = configModule;

    expect(config.env).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.appName).toBe('Koa Template App');
    expect(isDevelopment).toBe(true);
    expect(isProduction).toBe(false);
    expect(isTest).toBe(false);
  });

  it('应该加载测试环境配置', () => {
    process.env.NODE_ENV = 'test';

    const configModule = require('@/config');
    const config = configModule.default;
    const { isTest } = configModule;

    expect(config.env).toBe('test');
    expect(isTest).toBe(true);
  });

  it('应该加载生产环境配置', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.APP_NAME = 'Production App';
    process.env.JWT_SECRET = 'production_secret'; // 添加这个避免错误

    const configModule = require('@/config');
    const config = configModule.default;
    const { isProduction } = configModule;

    expect(config.env).toBe('production');
    expect(config.port).toBe(8080);
    expect(config.appName).toBe('Production App');
    expect(isProduction).toBe(true);
  });

  it('应该正确解析CORS配置', () => {
    process.env.CORS_CREDENTIALS = 'true';

    const config = require('@/config').default;

    expect(config.corsCredentials).toBe(true);
  });

  it('应该正确解析数组配置', () => {
    process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,image/png,application/pdf';

    const config = require('@/config').default;

    expect(config.uploadAllowedTypes).toEqual([
      'image/jpeg',
      'image/png',
      'application/pdf',
    ]);
  });

  it('应该在生产环境中验证JWT密钥', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'default_dev_secret_change_in_production';

    expect(() => {
      require('@/config');
    }).toThrow('JWT_SECRET must be set in production environment');
  });

  it('应该在生产环境中警告本地MongoDB', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'production_secret'; // 避免JWT错误
    process.env.MONGODB_URI = 'mongodb://localhost:27018/prod_db';
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    require('@/config');

    // 检查是否被调用，并且第一个参数包含指定文本
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Using local MongoDB in production is not recommended',
      ),
      expect.any(Object), // 第二个参数是上下文对象
    );

    consoleWarnSpy.mockRestore();
  });
});
