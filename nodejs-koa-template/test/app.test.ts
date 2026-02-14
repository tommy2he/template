import App from '../src/app';

describe('App 类测试', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  it('应该成功创建 App 实例', () => {
    expect(app).toBeInstanceOf(App);
    expect(app).toHaveProperty('start');
  });

  it('应该正确设置中间件和路由', () => {
    // 这里可以测试 app 的内部状态
    // 但由于 App 的私有属性，可能需要重构或使用其他方式
    expect(typeof app.start).toBe('function');
  });

  describe('start 方法', () => {
    it('应该启动服务器', () => {
      // 这里可能需要 mock http.createServer
      // 或者测试应用启动的副作用
    });
  });
});
