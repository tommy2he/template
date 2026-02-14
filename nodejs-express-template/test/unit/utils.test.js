// test/unit/utils.test.js
const { formatTimestamp, generateId } = require('../../src/utils/helpers');

describe('工具函数测试', () => {
  test('formatTimestamp 应该返回格式化的时间字符串', () => {
    const timestamp = Date.now();
    const formatted = formatTimestamp(timestamp);

    expect(typeof formatted).toBe('string');
    expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('generateId 应该返回唯一ID字符串', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(10);
    expect(id1).not.toBe(id2);
  });
});
