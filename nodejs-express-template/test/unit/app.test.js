// test/unit/app.test.js - 应用单元测试
const request = require('supertest');
const app = require('../../src/app');

describe('基础功能测试', () => {
  test('健康检查端点', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
  });

  test('根路径返回欢迎信息', async () => {
    const response = await request(app).get('/').set('Accept', 'application/json'); // 添加 Accept 头

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('欢迎');
    expect(response.body).toHaveProperty('version', '1.0.0');
  });

  test('API信息端点', async () => {
    const response = await request(app).get('/api/info');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('nodeVersion');
    expect(response.body).toHaveProperty('platform');
    expect(response.body).toHaveProperty('environment');
  });

  test('回显POST请求', async () => {
    const testData = { message: '测试数据', number: 123 };

    const response = await request(app)
      .post('/api/echo')
      .send(testData)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.received).toEqual(testData);
    expect(response.body).toHaveProperty('timestamp');
  });

  test('不存在的路由返回404', async () => {
    const response = await request(app).get('/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('找不到');
  });
});
