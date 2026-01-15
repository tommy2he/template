// src/monitor/exporter/metrics-exporter.ts
/* eslint-disable no-console */
import { register } from '../prometheus/client';

export class MetricsExporter {
  static async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      console.error('Failed to collect metrics:', error);
      return '# ERROR: Failed to collect metrics\n';
    }
  }

  static getContentType(): string {
    return register.contentType;
  }
}
