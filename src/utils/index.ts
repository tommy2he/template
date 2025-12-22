import { ValidationError } from './validator';

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 8): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 安全解析JSON
 */
export function safeParseJSON<T = any>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * 统一API响应格式
 */
export function apiResponse(data: any, message: string = 'success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * API错误响应
 */
export function apiError(message: string, code: string = 'ERROR', data?: any) {
  const error = new ValidationError(message);
  (error as any).code = code;
  (error as any).data = data;
  return error;
}
