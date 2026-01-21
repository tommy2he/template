// src/monitor/prometheus/metrics.ts
import { client, register } from './client';

// HTTP请求指标
export const httpMetrics = {
  requests: new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  }),

  duration: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),

  size: new client.Histogram({
    name: 'http_response_size_bytes',
    help: 'HTTP response size in bytes',
    labelNames: ['method', 'route'] as const,
    buckets: client.exponentialBuckets(100, 10, 8), // 100B to 100MB
    registers: [register],
  }),
};

// CPE业务指标
export const cpeMetrics = {
  onlineTotal: new client.Gauge({
    name: 'cpe_online_total',
    help: 'Total number of online CPE devices',
    registers: [register],
  }),

  onlineByModel: new client.Gauge({
    name: 'cpe_online_by_model',
    help: 'Number of online CPE devices by manufacturer and model',
    labelNames: ['manufacturer', 'model'] as const,
    registers: [register],
  }),

  connections: new client.Gauge({
    name: 'cpe_connections_active',
    help: 'Active WebSocket connections',
    registers: [register],
  }),

  heartbeats: new client.Gauge({
    name: 'cpe_heartbeats_total',
    help: 'Total heartbeat messages received',
    registers: [register],
  }),
};

// 数据库指标
export const dbMetrics = {
  queries: new client.Counter({
    name: 'db_queries_total',
    help: 'Total database queries',
    labelNames: ['operation', 'collection'] as const,
    registers: [register],
  }),

  queryDuration: new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'collection'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register],
  }),
};

export { register };
