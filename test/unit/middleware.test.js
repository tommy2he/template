// test/unit/middleware.test.js - 中间件测试
const request = require('supertest');
const app = require('../../src/app');

describe('中间件功能测试', () => {
  test('Helmet安全头', async () => {
    const response = await request(app).get('/');

    // 检查一些Helmet设置的安全头
    expect(response.headers).toHaveProperty('x-dns-prefetch-control');
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers).toHaveProperty('strict-transport-security');
  });

  test('CORS头设置', async () => {
    const response = await request(app).get('/');

    // 检查CORS头
    expect(response.headers).toHaveProperty('access-control-allow-origin');
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  test('JSON解析中间件', async () => {
    const testData = { name: '测试', value: 123 };

    const response = await request(app)
      .post('/api/echo')
      .send(testData)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.received).toEqual(testData);
  });

  test('Morgan日志中间件', async () => {
    // 这个测试主要是确保Morgan中间件不报错
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    // Morgan中间件正常工作（无错误）
  });
});
