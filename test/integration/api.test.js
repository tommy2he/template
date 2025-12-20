// test/integration/api.test.js - API集成测试
const request = require('supertest');

// 注意：这些测试需要服务器运行，我们在测试中启动和停止
describe('API集成测试', () => {
  let server;
  let baseUrl;

  // 启动测试服务器
  beforeAll(done => {
    const app = require('../../src/app');
    const PORT = process.env.TEST_PORT || 3001; // 使用不同端口避免冲突
    server = app.listen(PORT, () => {
      baseUrl = `http://localhost:${PORT}`;
      console.log(`测试服务器运行在 ${baseUrl}`);
      done();
    });
  });

  // 关闭测试服务器
  afterAll(done => {
    if (server) {
      server.close(done);
    }
  });

  describe('路由功能测试', () => {
    test('路由模块根路径', async () => {
      const response = await request(baseUrl).get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('路由模块');
    });

    test('示例路由', async () => {
      const response = await request(baseUrl).get('/api/example');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('这是一个示例路由');
      expect(response.body.data).toHaveProperty('name', '示例项目');
    });

    test('用户列表路由', async () => {
      const response = await request(baseUrl).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    test('单个用户路由', async () => {
      const response = await request(baseUrl).get('/api/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
    });

    test('不存在的用户返回404', async () => {
      const response = await request(baseUrl).get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('静态文件服务测试', () => {
    test('前端页面可访问', async () => {
      const response = await request(baseUrl).get('/');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json'); // API根路径返回JSON
    });

    test('静态HTML文件', async () => {
      const response = await request(baseUrl).get('/index.html');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
    });
  });

  describe('错误处理测试', () => {
    test('无效的POST请求体', async () => {
      const response = await request(baseUrl)
        .post('/api/echo')
        .send('无效的JSON')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });
});
