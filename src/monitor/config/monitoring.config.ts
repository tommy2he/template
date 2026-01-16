// src/monitor/config/monitoring.config.ts
import { HTTPCollectorConfig } from '../collectors/http-collector-enhanced';

export interface MonitoringConfig {
  http: HTTPCollectorConfig;
  prometheus: {
    enabled: boolean;
    path: string;
    port?: number;
  };
}

// 从环境变量获取Prometheus路径，确保所有地方使用同一个配置
const prometheusPath = process.env.PROMETHEUS_PATH || '/metrics';

export const defaultMonitoringConfig: MonitoringConfig = {
  http: {
    enabled: true,
    recordSize: true,
    normalizeRoutes: true,
    logRequests: process.env.NODE_ENV === 'development',
    excludedRoutes: [
      prometheusPath, // 使用配置的路径，确保一致性
      '/api/health',
      '/api/performance',
      '/api-docs',
      '/favicon.ico',
    ],
    includeQueryParams: false,
  },
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED !== 'false',
    path: prometheusPath, // 使用相同的变量
    port: process.env.PROMETHEUS_PORT
      ? parseInt(process.env.PROMETHEUS_PORT)
      : undefined,
  },
};
