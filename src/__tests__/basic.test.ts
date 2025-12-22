/// <reference types="jest" />

describe('Basic Test Suite', () => {
  it('应该通过基本测试', () => {
    expect(true).toBe(true);
  });

  it('应该计算数字', () => {
    expect(1 + 1).toBe(2);
  });

  it('应该处理字符串', () => {
    expect('hello').toContain('hell');
  });
});

describe('异步测试', () => {
  it('应该处理异步操作', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
