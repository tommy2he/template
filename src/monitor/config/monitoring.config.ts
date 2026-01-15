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

export const defaultMonitoringConfig: MonitoringConfig = {
  http: {
    enabled: true,
    recordSize: true,
    normalizeRoutes: true,
    logRequests: process.env.NODE_ENV === 'development',
    excludedRoutes: [
      '/metrics',
      '/api/health',
      '/api/performance',
      '/api-docs',
      '/api-docs/',
      '/favicon.ico',
    ],
    includeQueryParams: false,
  },
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED !== 'false',
    path: process.env.PROMETHEUS_PATH || '/metrics',
    port: process.env.PROMETHEUS_PORT
      ? parseInt(process.env.PROMETHEUS_PORT)
      : undefined,
  },
};
