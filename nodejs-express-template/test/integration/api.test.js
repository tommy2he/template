// test/integration/api.test.js - API集成测试
const request = require('supertest');
const app = require('../../src/app');

// 不再自己启动服务器，直接使用supertest测试app
// 这样可以避免服务器关闭的问题

describe('API集成测试', () => {
  describe('路由功能测试', () => {
    test('路由模块根路径', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('路由模块');
    });

    test('示例路由', async () => {
      const response = await request(app).get('/api/example');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('这是一个示例路由');
      expect(response.body.data).toHaveProperty('name', '示例项目');
    });

    test('用户列表路由', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    test('单个用户路由', async () => {
      const response = await request(app).get('/api/users/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
    });

    test('不存在的用户返回404', async () => {
      const response = await request(app).get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('静态文件服务测试', () => {
    test('前端页面可访问（重定向）', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/index.html');
    });

    test('根路径返回 JSON 当 Accept 头包含 application/json', async () => {
      const response = await request(app).get('/').set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toHaveProperty('message');
    });

    test('静态HTML文件', async () => {
      const response = await request(app).get('/index.html');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
    });
  });

  describe('错误处理测试', () => {
    test('无效的POST请求体', async () => {
      // 静默console.error输出
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const response = await request(app)
        .post('/api/echo')
        .send('无效的JSON')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);

      // 恢复console.error
      consoleErrorSpy.mockRestore();
    });
  });
});
