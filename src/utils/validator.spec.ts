import { ValidationError, validateString, validateNumber } from './validator';

describe('Validator Utils', () => {
  describe('ValidationError', () => {
    it('应该创建带有正确属性的ValidationError实例', () => {
      const error = new ValidationError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ValidationError');
      expect(error.status).toBe(400);
      expect(error.expose).toBe(true);
    });
  });

  describe('validateString 函数', () => {
    it('应该验证必填字符串字段', () => {
      expect(() =>
        validateString(undefined, 'username', { required: true }),
      ).toThrow('username is required');
      expect(() =>
        validateString(null, 'username', { required: true }),
      ).toThrow('username is required');
      expect(() => validateString('', 'username', { required: true })).toThrow(
        'username is required',
      );
    });

    it('应该验证输入是否为字符串类型', () => {
      expect(() => validateString(123, 'name')).toThrow(
        'name must be a string',
      );
      expect(() => validateString({}, 'name')).toThrow('name must be a string');
      expect(() => validateString([], 'name')).toThrow('name must be a string');
    });

    it('应该验证字符串的最小长度', () => {
      expect(() => validateString('ab', 'password', { minLength: 6 })).toThrow(
        'password must be at least 6 characters',
      );
      // 边界测试：刚好等于最小长度
      expect(validateString('abcdef', 'password', { minLength: 6 })).toBe(
        'abcdef',
      );
    });

    it('应该验证字符串的最大长度', () => {
      expect(() =>
        validateString('too_long', 'code', { maxLength: 5 }),
      ).toThrow('code must be at most 5 characters');
      // 边界测试：刚好等于最大长度
      expect(validateString('abcde', 'code', { maxLength: 5 })).toBe('abcde');
    });

    it('应该验证字符串是否符合正则表达式模式', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(() =>
        validateString('invalid-email', 'email', { pattern: emailPattern }),
      ).toThrow('email has invalid format');
      // 有效邮箱应该通过
      expect(
        validateString('test@example.com', 'email', { pattern: emailPattern }),
      ).toBe('test@example.com');
    });

    it('应该自动去除字符串两端的空格', () => {
      const result = validateString('  hello world  ', 'text');
      expect(result).toBe('hello world');
    });

    it('对于非必填字段，空值应返回空字符串', () => {
      expect(validateString(undefined, 'optional')).toBe('');
      expect(validateString(null, 'optional')).toBe('');
      expect(validateString('', 'optional')).toBe('');
    });
  });

  describe('validateNumber 函数', () => {
    it('应该验证必填数字字段', () => {
      expect(() =>
        validateNumber(undefined, 'age', { required: true }),
      ).toThrow('age is required');
      expect(() => validateNumber(null, 'age', { required: true })).toThrow(
        'age is required',
      );
    });

    it('应该验证输入是否能转换为有效数字', () => {
      expect(() => validateNumber('not a number', 'count')).toThrow(
        'count must be a number',
      );
      expect(() => validateNumber(NaN, 'count')).toThrow(
        'count must be a number',
      );
    });

    it('应该验证数字的最小值', () => {
      expect(() => validateNumber(15, 'age', { min: 18 })).toThrow(
        'age must be at least 18',
      );
      // 边界测试：刚好等于最小值
      expect(validateNumber(18, 'age', { min: 18 })).toBe(18);
    });

    it('应该验证数字的最大值', () => {
      expect(() => validateNumber(150, 'age', { max: 100 })).toThrow(
        'age must be at most 100',
      );
      // 边界测试：刚好等于最大值
      expect(validateNumber(100, 'age', { max: 100 })).toBe(100);
    });

    it('应该正确转换数字字符串', () => {
      expect(validateNumber('42', 'answer')).toBe(42);
      expect(validateNumber('3.14', 'pi')).toBe(3.14);
      expect(validateNumber('-10', 'temperature')).toBe(-10);
    });

    it('对于非必填字段，空值应返回0', () => {
      expect(validateNumber(undefined, 'optional')).toBe(0);
      expect(validateNumber(null, 'optional')).toBe(0);
    });
  });

  // 新增：边缘情况和集成测试
  describe('边缘情况', () => {
    it('应该处理包含空格的数字字符串', () => {
      // 注意：JavaScript的Number()函数会忽略字符串前后的空格
      expect(validateNumber('  42  ', 'number')).toBe(42);
    });

    it('应该组合验证最小值和最大值', () => {
      const options = { min: 1, max: 10 };
      expect(validateNumber(5, 'score', options)).toBe(5);
      expect(() => validateNumber(0, 'score', options)).toThrow();
      expect(() => validateNumber(11, 'score', options)).toThrow();
    });
  });
});
