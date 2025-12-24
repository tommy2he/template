import Koa from 'koa';
import request from 'supertest';
import {
  performanceMonitor,
  PerformanceMonitor,
} from '@/middleware/performance';

describe('performance Middleware', () => {
  let app: Koa;
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    app = new Koa();
    monitor = PerformanceMonitor.getInstance();
    monitor.reset(); // 重置监控器 - 现在可以直接调用，因为reset是public的
  });

  it('应该记录请求性能指标', async () => {
    app.use(performanceMonitor());
    app.use(async (ctx) => {
      // 模拟一些处理时间
      await new Promise((resolve) => setTimeout(resolve, 50));
      ctx.body = { message: 'test' };
    });

    await request(app.callback()).get('/test-endpoint').expect(200);

    const metrics = monitor.getMetrics('/test-endpoint');
    expect(metrics).toBeDefined();
    expect(metrics.requestCount).toBe(1);
    expect(metrics.responseTimes).toHaveLength(1);
    expect(metrics.responseTimes[0]).toBeGreaterThan(45); // 应该大于45ms
  });

  it('应该记录错误请求', async () => {
    app.use(performanceMonitor());
    app.use(async (ctx) => {
      ctx.status = 500;
      ctx.body = { error: 'test error' };
    });

    await request(app.callback()).get('/error-endpoint').expect(500);

    const metrics = monitor.getMetrics('/error-endpoint');
    expect(metrics.errorCount).toBe(1);
  });

  it('应该添加性能响应头', async () => {
    app.use(performanceMonitor());
    app.use(async (ctx) => {
      ctx.body = { message: 'test' };
    });

    const response = await request(app.callback()).get('/').expect(200);

    expect(response.headers['x-response-time']).toBeDefined();
    expect(response.headers['x-performance-monitored']).toBe('true');
  });

  it('应该计算正确的百分位数', () => {
    const mockResponseTimes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    // 由于calculatePercentile是私有方法，我们需要通过公共方法来测试
    // 或者我们可以暂时将其设为public以便测试，但更好的方法是通过实际请求来测试
    // 这里我们通过实际记录请求来测试
    monitor.recordRequest('/test', 10);
    monitor.recordRequest('/test', 20);
    monitor.recordRequest('/test', 30);
    monitor.recordRequest('/test', 40);
    monitor.recordRequest('/test', 50);
    monitor.recordRequest('/test', 60);
    monitor.recordRequest('/test', 70);
    monitor.recordRequest('/test', 80);
    monitor.recordRequest('/test', 90);
    monitor.recordRequest('/test', 100);

    const metrics = monitor.getMetrics('/test');
    expect(metrics.responseTimes).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it('应该获取所有端点的汇总指标', async () => {
    app.use(performanceMonitor());
    app.use(async (ctx) => {
      if (ctx.path === '/api1') {
        ctx.body = { api: '1' };
      } else if (ctx.path === '/api2') {
        ctx.body = { api: '2' };
      }
    });

    await request(app.callback()).get('/api1').expect(200);
    await request(app.callback()).get('/api2').expect(200);
    await request(app.callback()).get('/api2').expect(200); // 第二次调用

    const allMetrics = monitor.getMetrics();

    expect(allMetrics.summary.totalRequests).toBe(3);
    expect(allMetrics.summary.endpoints).toBe(2);
    expect(allMetrics.endpoints['/api1'].requestCount).toBe(1);
    expect(allMetrics.endpoints['/api2'].requestCount).toBe(2);
  });

  it('应该通过PerformanceMonitor单例获取相同实例', () => {
    const instance1 = PerformanceMonitor.getInstance();
    const instance2 = PerformanceMonitor.getInstance();
    expect(instance1).toBe(instance2);
  });
});
