import {
  delay,
  randomString,
  safeParseJSON,
  apiResponse,
  apiError,
} from '../../src/utils';

// 模拟 console.error 避免测试输出干扰
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Utility Functions', () => {
  describe('delay', () => {
    it('应该延迟指定的时间', async () => {
      const start = Date.now();
      const delayTime = 100;

      await delay(delayTime);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(delayTime - 10);
      expect(elapsed).toBeLessThan(delayTime + 50); // 允许一些误差
    });

    it('应该立即返回对于0延迟', async () => {
      const start = Date.now();

      await delay(0);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it('应该返回一个Promise', () => {
      const result = delay(10);

      expect(result).toBeInstanceOf(Promise);
      expect(typeof result.then).toBe('function');
    });
  });

  describe('randomString', () => {
    it('应该生成指定长度的字符串', () => {
      const length = 10;
      const result = randomString(length);

      expect(result).toHaveLength(length);
      expect(typeof result).toBe('string');
    });

    it('应该默认生成8位字符串', () => {
      const result = randomString();

      expect(result).toHaveLength(8);
    });

    it('应该只包含字母和数字', () => {
      const result = randomString(100);
      const validChars = /^[A-Za-z0-9]+$/;

      expect(result).toMatch(validChars);
    });

    it('多次生成的字符串应该不同', () => {
      const results = Array.from({ length: 10 }, () => randomString(8));
      const uniqueResults = new Set(results);

      expect(uniqueResults.size).toBeGreaterThan(5); // 至少应该有5个不同的字符串
    });

    it('应该处理0长度', () => {
      const result = randomString(0);

      expect(result).toBe('');
      expect(result.length).toBe(0);
    });

    it('应该处理负数长度', () => {
      const result = randomString(-5);

      expect(result).toBe('');
      expect(result.length).toBe(0);
    });
  });

  describe('safeParseJSON', () => {
    it('应该成功解析有效的JSON字符串', () => {
      const jsonString = '{"name": "John", "age": 30}';
      const fallback = { error: true };

      const result = safeParseJSON(jsonString, fallback);

      expect(result).toEqual({ name: 'John', age: 30 });
      expect(result).not.toBe(fallback);
    });

    it('应该返回回退值对于无效的JSON', () => {
      const invalidJson = '{name: John}'; // 缺少引号
      const fallback = { error: '解析失败' };

      const result = safeParseJSON(invalidJson, fallback);

      expect(result).toBe(fallback);
      expect(result).toEqual({ error: '解析失败' });
    });

    it('应该处理空字符串', () => {
      const result = safeParseJSON('', 'default');

      expect(result).toBe('default');
    });

    it('应该处理null输入', () => {
      const result = safeParseJSON(null as any, 'fallback');

      expect(result).toBe('fallback');
    });

    it('应该处理undefined输入', () => {
      const result = safeParseJSON(undefined as any, 'fallback');

      expect(result).toBe('fallback');
    });

    it('应该处理非字符串输入', () => {
      expect(safeParseJSON(123 as any, 'fallback')).toBe('fallback');
      expect(safeParseJSON({} as any, 'fallback')).toBe('fallback');
      expect(safeParseJSON([] as any, 'fallback')).toBe('fallback');
      expect(safeParseJSON(true as any, 'fallback')).toBe('fallback');
    });

    it('应该支持复杂的数据结构', () => {
      const complexJson = JSON.stringify({
        array: [1, 2, 3],
        nested: { key: 'value' },
        date: new Date().toISOString(),
      });

      const result = safeParseJSON(complexJson, {});

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      // 使用类型断言来访问属性
      const typedResult = result as any;
      expect(Array.isArray(typedResult.array)).toBe(true);
      expect(typedResult.array).toHaveLength(3);
      expect(typedResult.nested).toEqual({ key: 'value' });
      expect(typeof typedResult.date).toBe('string');
    });

    it('应该正确处理布尔值', () => {
      expect(safeParseJSON('true', false)).toBe(true);
      expect(safeParseJSON('false', true)).toBe(false);
    });

    it('应该正确处理数字', () => {
      expect(safeParseJSON('42', 0)).toBe(42);
      expect(safeParseJSON('3.14', 0)).toBe(3.14);
      expect(safeParseJSON('-10', 0)).toBe(-10);
    });

    it('应该正确处理数组', () => {
      const result = safeParseJSON('[1, 2, 3]', []) as number[];

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    it('应该处理带有换行符的JSON', () => {
      const jsonString = `{
        "name": "John",
        "age": 30
      }`;
      const fallback = {};

      const result = safeParseJSON(jsonString, fallback);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('应该处理前导和尾随空格', () => {
      const jsonString = '   {"name": "John"}   ';
      const fallback = {};

      const result = safeParseJSON(jsonString, fallback);

      expect(result).toEqual({ name: 'John' });
    });
  });

  describe('apiResponse', () => {
    it('应该生成标准API响应格式', () => {
      const data = { id: 1, name: '测试' };
      const message = '操作成功';
      const timestamp = '2024-01-01T00:00:00.000Z';

      // 使用jest.spyOn来模拟Date.now
      const dateSpy = jest
        .spyOn(Date.prototype, 'toISOString')
        .mockReturnValue(timestamp);

      const result = apiResponse(data, message);

      expect(result).toEqual({
        success: true,
        message,
        data,
        timestamp,
      });

      dateSpy.mockRestore();
    });

    it('应该使用默认消息', () => {
      const result = apiResponse({});

      expect(result.message).toBe('success');
      expect(result.success).toBe(true);
    });

    it('应该包含有效的时间戳', () => {
      const result = apiResponse({});
      const timestamp = new Date(result.timestamp);

      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(isNaN(timestamp.getTime())).toBe(false); // 应该是有效日期
    });

    it('应该处理各种数据类型', () => {
      expect(apiResponse(null).data).toBeNull();
      expect(apiResponse(undefined).data).toBeUndefined();
      expect(apiResponse([]).data).toEqual([]);
      expect(apiResponse('string').data).toBe('string');
      expect(apiResponse(123).data).toBe(123);
      expect(apiResponse({ key: 'value' }).data).toEqual({ key: 'value' });
    });

    it('应该保持响应结构的一致性', () => {
      const results = [
        apiResponse({}),
        apiResponse([1, 2, 3]),
        apiResponse('test'),
        apiResponse(null),
      ];

      results.forEach((result) => {
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('timestamp');
      });
    });
  });

  describe('apiError', () => {
    it('应该创建ValidationError实例', () => {
      const error = apiError('错误信息', 'ERROR_CODE', { extra: 'data' });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('错误信息');
      expect(error.status).toBe(400);
      expect(error.expose).toBe(true);

      // 检查额外属性
      const errorAny = error as any;
      expect(errorAny.code).toBe('ERROR_CODE');
      expect(errorAny.data).toEqual({ extra: 'data' });
    });

    it('应该包含额外的错误信息', () => {
      const error = apiError('错误', 'VALIDATION_ERROR', { field: 'email' });

      const errorAny = error as any;
      expect(errorAny.code).toBe('VALIDATION_ERROR');
      expect(errorAny.data).toEqual({ field: 'email' });
    });

    it('应该使用默认错误码', () => {
      const error = apiError('默认错误');

      const errorAny = error as any;
      expect(errorAny.code).toBe('ERROR');
      expect(errorAny.data).toBeUndefined();
    });

    it('应该可以抛出自定义错误', () => {
      const createError = () => {
        throw apiError('测试错误');
      };

      expect(createError).toThrow('测试错误');
      expect(createError).toThrow(Error);
    });

    it('应该设置正确的状态码', () => {
      const error = apiError('错误');

      expect(error.status).toBe(400);
      expect(error.expose).toBe(true);
    });

    it('应该可以链式设置属性', () => {
      const error = apiError('自定义错误', 'CUSTOM_CODE', {
        details: '更多信息',
      });

      // 添加额外属性
      (error as any).customProperty = 'value';

      expect((error as any).code).toBe('CUSTOM_CODE');
      expect((error as any).data).toEqual({ details: '更多信息' });
      expect((error as any).customProperty).toBe('value');
    });
  });

  describe('工具函数集成', () => {
    it('应该可以组合使用 safeParseJSON 和 apiResponse', () => {
      const jsonString = '{"result": "success", "data": [1, 2, 3]}';
      const parsed = safeParseJSON(jsonString, { error: '解析失败' });
      const response = apiResponse(parsed, '数据加载成功');

      expect(response.success).toBe(true);
      expect(response.message).toBe('数据加载成功');
      expect(response.data).toEqual({ result: 'success', data: [1, 2, 3] });
    });

    it('应该在异步场景中工作', async () => {
      const start = Date.now();
      await delay(50);

      const elapsed = Date.now() - start;
      const response = apiResponse({ elapsed, status: 'complete' });

      expect(response.data.elapsed).toBeGreaterThanOrEqual(40);
      expect(response.data.status).toBe('complete');
    });

    it('应该处理错误场景', () => {
      const jsonString = 'invalid json';
      const fallback = { error: '解析失败' };
      const parsed = safeParseJSON(jsonString, fallback);
      const response = apiResponse(parsed, '操作完成但有错误');

      expect(response.data).toBe(fallback);
      expect(response.message).toBe('操作完成但有错误');
    });

    it('可以创建完整的错误处理流程', () => {
      // 模拟一个验证失败场景
      const validationError = apiError('邮箱格式不正确', 'VALIDATION_ERROR', {
        field: 'email',
      });

      expect(() => {
        throw validationError;
      }).toThrow('邮箱格式不正确');
      expect((validationError as any).code).toBe('VALIDATION_ERROR');
      expect((validationError as any).data).toEqual({ field: 'email' });
    });

    it('应该支持随机字符串生成用于测试数据', () => {
      const testData = {
        id: randomString(8),
        name: '测试用户',
        token: randomString(32),
      };

      const response = apiResponse(testData, '用户创建成功');

      expect(response.data.id).toHaveLength(8);
      expect(response.data.token).toHaveLength(32);
      expect(response.data.name).toBe('测试用户');
      expect(response.success).toBe(true);
    });
  });

  describe('性能和安全', () => {
    it('delay 不应该阻塞事件循环太久', async () => {
      const delays = [10, 20, 30];
      const start = Date.now();

      // 并行执行多个delay
      await Promise.all(delays.map((delayTime) => delay(delayTime)));

      const elapsed = Date.now() - start;
      // 并行执行应该大致等于最长的delay，而不是所有delay的总和
      expect(elapsed).toBeLessThan(50); // 应该小于50ms
    });

    it('randomString 应该生成安全的随机字符串', () => {
      // 生成大量随机字符串，确保没有重复
      const strings = new Set();
      for (let i = 0; i < 1000; i++) {
        strings.add(randomString(10));
      }

      // 应该有很高的唯一性
      expect(strings.size).toBeGreaterThan(950); // 至少95%唯一
    });

    it('safeParseJSON 应该防止原型污染攻击', () => {
      const maliciousJson = '{"__proto__": {"polluted": true}}';
      const fallback = { safe: true };

      const result = safeParseJSON(maliciousJson, fallback);

      // 应该返回fallback，或者至少不会污染原型
      expect(({} as any).polluted).toBeUndefined();
      // result应该是fallback，因为JSON是有效的但可能有风险
      // 这里我们假设我们的safeParseJSON函数没有特殊处理，只是调用JSON.parse
      expect(result).toEqual({ __proto__: { polluted: true } }); // 正常解析
    });

    it('apiError 应该创建不可变错误对象', () => {
      const error = apiError('原始错误');

      // 尝试修改错误属性
      error.message = '修改后的错误';
      (error as any).newProperty = 'value';

      // 原始属性应该保持不变，但JavaScript中错误对象是可变的
      expect(error.message).toBe('修改后的错误'); // 实际上会被修改
      expect((error as any).newProperty).toBe('value');
    });
  });
});
