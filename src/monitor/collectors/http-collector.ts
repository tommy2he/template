// src/monitor/collectors/http-collector.ts
/* eslint-disable no-console */
import { Context, Next } from 'koa';
import { httpMetrics } from '../prometheus/metrics';

export class HTTPCollector {
  /**
   * Koa中间件：收集HTTP请求指标
   */
  static createMiddleware() {
    return async (ctx: Context, next: Next): Promise<void> => {
      const start = Date.now();

      try {
        // 执行后续中间件
        await next();

        // 请求成功后记录指标
        this.recordRequest(ctx, start, false);
      } catch (error) {
        // 请求失败时也记录指标
        this.recordRequest(ctx, start, true);
        throw error; // 继续抛出错误，让错误处理中间件处理
      }
    };
  }

  /**
   * 记录HTTP请求指标
   */
  private static recordRequest(
    ctx: Context,
    startTime: number,
    isError: boolean,
  ): void {
    const duration = Date.now() - startTime;
    const durationSeconds = duration / 1000; // 转换为秒

    // 获取路由路径（去除查询参数）
    const route = this.normalizeRoute(ctx.path);

    // 获取HTTP方法
    const method = ctx.method.toUpperCase();

    // 获取状态码
    const status = ctx.status || (isError ? 500 : 200);
    const statusGroup = this.getStatusGroup(status);

    // 记录请求计数
    httpMetrics.requests.inc({
      method,
      route,
      status: statusGroup,
    });

    // 记录请求持续时间
    httpMetrics.duration.observe(
      {
        method,
        route,
      },
      durationSeconds,
    );

    // 记录响应大小（如果有）
    const responseSize = this.getResponseSize(ctx);
    if (responseSize > 0) {
      httpMetrics.size.observe(
        {
          method,
          route,
        },
        responseSize,
      );
    }

    // 可选：在开发环境记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `📊 [HTTP监控] ${method} ${route} - ${status} (${duration}ms, ${responseSize} bytes)`,
      );
    }
  }

  /**
   * 规范化路由路径
   * 将动态路径参数（如 /users/123）转换为模式（如 /users/:id）
   */
  private static normalizeRoute(path: string): string {
    // 简单的路由规范化
    // 在实际项目中，你可能需要根据路由定义来规范化

    // 移除查询参数
    const cleanPath = path.split('?')[0];

    // 如果是API路径，进行简化
    if (cleanPath.startsWith('/api/')) {
      // 处理数字ID
      const normalized = cleanPath.replace(/\/\d+(?=\/|$)/g, '/:id');

      // 处理UUID
      return normalized.replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
        '/:uuid',
      );
    }

    return cleanPath;
  }

  /**
   * 获取状态码分组
   */
  private static getStatusGroup(status: number): string {
    if (status >= 200 && status < 300) return '2xx';
    if (status >= 300 && status < 400) return '3xx';
    if (status >= 400 && status < 500) return '4xx';
    if (status >= 500) return '5xx';
    return 'unknown';
  }

  /**
   * 获取响应大小
   */
  private static getResponseSize(ctx: Context): number {
    // 尝试从Content-Length头获取
    const contentLength = ctx.response.get('Content-Length');
    if (contentLength) {
      return parseInt(contentLength, 10) || 0;
    }

    // 如果响应体是字符串或Buffer，计算长度
    if (ctx.body) {
      if (typeof ctx.body === 'string') {
        return Buffer.byteLength(ctx.body, 'utf8');
      }
      if (Buffer.isBuffer(ctx.body)) {
        return ctx.body.length;
      }
      // 如果是对象，转换为JSON字符串后计算
      try {
        const jsonString = JSON.stringify(ctx.body);
        return Buffer.byteLength(jsonString, 'utf8');
      } catch {
        return 0;
      }
    }

    return 0;
  }

  /**
   * 手动记录HTTP请求（用于不在中间件链中的请求）
   */
  static recordManualRequest(
    method: string,
    route: string,
    status: number,
    durationMs: number,
    sizeBytes?: number,
  ): void {
    const durationSeconds = durationMs / 1000;
    const statusGroup = this.getStatusGroup(status);

    httpMetrics.requests.inc({
      method: method.toUpperCase(),
      route: this.normalizeRoute(route),
      status: statusGroup,
    });

    httpMetrics.duration.observe(
      {
        method: method.toUpperCase(),
        route: this.normalizeRoute(route),
      },
      durationSeconds,
    );

    if (sizeBytes !== undefined && sizeBytes > 0) {
      httpMetrics.size.observe(
        {
          method: method.toUpperCase(),
          route: this.normalizeRoute(route),
        },
        sizeBytes,
      );
    }
  }

  /**
   * 获取HTTP指标摘要（用于调试）
   */
  static getSummary() {
    return {
      requests: (httpMetrics.requests as any).hashMap,
      duration: (httpMetrics.duration as any).hashMap,
      size: (httpMetrics.size as any).hashMap,
    };
  }
}

// 默认导出中间件创建函数
export default HTTPCollector.createMiddleware;
