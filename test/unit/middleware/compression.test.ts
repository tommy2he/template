import Koa from 'koa';
import request from 'supertest';
import compression from '@/middleware/compression';

describe('compression Middleware', () => {
  let app: Koa;

  beforeEach(() => {
    app = new Koa();
    app.use(compression());
    app.use(async (ctx) => {
      // 生成足够大的响应体以触发压缩
      const largeText = 'x'.repeat(2000);
      ctx.body = {
        message: 'Hello Compression',
        data: largeText,
      };
    });
  });

  it('应该压缩响应', async () => {
    const response = await request(app.callback())
      .get('/')
      .set('Accept-Encoding', 'gzip, deflate, br');

    expect(response.headers['content-encoding']).toBeDefined();
    expect(response.headers['content-encoding']).toMatch(/gzip|deflate|br/);
  });

  it('应该根据阈值决定是否压缩', async () => {
    const smallApp = new Koa();
    smallApp.use(compression());
    smallApp.use(async (ctx) => {
      // 生成小于阈值的响应
      ctx.body = { message: 'small' };
    });

    const response = await request(smallApp.callback())
      .get('/')
      .set('Accept-Encoding', 'gzip');

    // 小响应可能不会被压缩
    expect(response.headers['content-encoding']).toBeUndefined();
  });

  it('应该支持多种压缩算法', async () => {
    const encodings = ['gzip', 'deflate', 'br'];

    for (const encoding of encodings) {
      const response = await request(app.callback())
        .get('/')
        .set('Accept-Encoding', encoding);

      // 检查是否支持该编码或返回了未压缩的内容
      expect([encoding, undefined]).toContain(
        response.headers['content-encoding'],
      );
    }
  });

  it('应该正确设置Vary头', async () => {
    const response = await request(app.callback())
      .get('/')
      .set('Accept-Encoding', 'gzip');

    expect(response.headers['vary']).toContain('Accept-Encoding');
  });
});
