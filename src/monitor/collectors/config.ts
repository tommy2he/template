// src/monitor/collectors/config.ts
export interface HTTPCollectorConfig {
  enabled: boolean;
  recordSize: boolean;
  normalizeRoutes: boolean;
  logRequests: boolean;
  excludedRoutes: string[];
}

export const defaultHTTPCollectorConfig: HTTPCollectorConfig = {
  enabled: true,
  recordSize: true,
  normalizeRoutes: true,
  logRequests: process.env.NODE_ENV === 'development',
  excludedRoutes: [
    '/metrics', // Prometheus metrics端点
    '/api/health', // 健康检查
    '/api/performance', // 性能端点
    '/favicon.ico', // 图标
  ],
};
