// test/setup.js - 测试环境设置
jest.setTimeout(10000); // 设置超时时间为10秒

// 全局测试前置和清理
beforeAll(() => {
  console.log('测试开始...');
});

afterAll(() => {
  console.log('测试结束...');
});

// 在每个测试前重置模块注册表
beforeEach(() => {
  jest.resetModules();
});
