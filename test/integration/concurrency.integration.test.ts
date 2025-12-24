import request from 'supertest';
import Koa from 'koa';
import Router from 'koa-router';
import middleware from '../../src/middleware';
import apiRoutes from '../../src/routes/api';

describe('Concurrency Integration Tests', () => {
  let app: Koa;
  let server: any;

  beforeAll(() => {
    app = new Koa();
    middleware(app);

    const router = new Router();
    router.use('/api', apiRoutes.routes(), apiRoutes.allowedMethods());
    app.use(router.routes()).use(router.allowedMethods());

    server = app.listen(3002); // 使用不同的端口避免冲突
  });

  afterAll(() => {
    server.close();
  });

  describe('并发请求处理', () => {
    it('应该处理多个并发请求', async () => {
      const numRequests = 50;
      const requests = Array(numRequests)
        .fill(null)
        .map((_, i) => request(server).get(`/api/echo/test${i}`).expect(200));

      const responses = await Promise.all(requests);

      // 验证所有请求都成功
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.original).toBe(`test${i}`);
      });
    }, 30000);

    it('应该在高并发下保持稳定', async () => {
      const endpoints = ['/', '/api', '/api/health', '/api/status'];
      const numRequestsPerEndpoint = 25;

      const allRequests: Promise<any>[] = [];

      endpoints.forEach((endpoint) => {
        for (let i = 0; i < numRequestsPerEndpoint; i++) {
          allRequests.push(
            request(server)
              .get(endpoint)
              .then((response) => ({ endpoint, status: response.status })),
          );
        }
      });

      const results = await Promise.allSettled(allRequests);

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      console.log(
        `并发测试结果: 成功 ${successful.length}, 失败 ${failed.length}`,
      );

      expect(failed.length).toBeLessThanOrEqual(5); // 允许少量失败
      expect(successful.length).toBeGreaterThan(90); // 至少90%成功率
    }, 60000);

    it('应该正确处理混合请求类型', async () => {
      const requests = [
        request(server).get('/api/health'),
        request(server).get('/api/status'),
        request(server).post('/api/echo').send({ message: 'concurrent test' }),
        request(server).get('/api/echo/mixed'),
        request(server).get('/api/performance/health'),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    }, 30000);
  });

  describe('内存泄漏检测', () => {
    it('重复请求不应该导致内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 发送大量请求
      for (let i = 0; i < 1000; i++) {
        await request(server).get('/api/health').expect(200);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `内存使用: 初始 ${(initialMemory / 1024 / 1024).toFixed(2)}MB, 最终 ${(finalMemory / 1024 / 1024).toFixed(2)}MB, 增加 ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      );

      // 内存增加应该小于50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 60000);
  });
});
