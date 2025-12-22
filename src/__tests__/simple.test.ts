test('最简单的测试', () => {
  expect(1 + 1).toBe(2);
});

describe('测试套件', () => {
  it('应该通过', () => {
    expect(true).toBe(true);
  });
});
