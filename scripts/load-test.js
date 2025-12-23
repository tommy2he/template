#!/usr/bin/env node

const http = require('http');

class LoadTest {
  constructor(port = 3000) {
    this.port = port;
    this.results = {
      total: 0,
      success: 0,
      failed: 0,
      times: [],
      startTime: null,
      endTime: null,
    };
  }

  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const req = http.request(
        {
          hostname: 'localhost',
          port: this.port,
          path: path,
          method: 'GET',
          timeout: 5000,
        },
        (res) => {
          const data = [];
          res.on('data', (chunk) => data.push(chunk));
          res.on('end', () => {
            const elapsed = Date.now() - start;
            this.results.times.push(elapsed);

            if (res.statusCode === 200) {
              this.results.success++;
              resolve({
                status: res.statusCode,
                elapsed,
                data: Buffer.concat(data).toString(),
              });
            } else {
              this.results.failed++;
              resolve({
                status: res.statusCode,
                elapsed,
                data: Buffer.concat(data).toString(),
              });
            }
          });
        },
      );

      req.on('error', (error) => {
        this.results.failed++;
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        this.results.failed++;
        reject(new Error('请求超时'));
      });

      req.end();
    });
  }

  async runLoadTest(config) {
    const { requests, concurrency, path } = config;

    console.log(`🚀 开始负载测试: ${requests} 请求, ${concurrency} 并发`);
    this.results.startTime = Date.now();

    const batches = [];
    for (let i = 0; i < requests; i += concurrency) {
      const batchSize = Math.min(concurrency, requests - i);
      batches.push(batchSize);
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batchSize = batches[batchIndex];
      console.log(
        `处理批次 ${batchIndex + 1}/${batches.length} (${batchSize} 请求)`,
      );

      const promises = [];
      for (let j = 0; j < batchSize; j++) {
        promises.push(this.makeRequest(path));
      }

      await Promise.allSettled(promises);
      this.results.total += batchSize;

      // 显示进度
      const progress = ((this.results.total / requests) * 100).toFixed(1);
      console.log(`进度: ${progress}% (${this.results.total}/${requests})`);
    }

    this.results.endTime = Date.now();
    this.printResults();
  }

  printResults() {
    const totalTime = this.results.endTime - this.results.startTime;
    const avgTime =
      this.results.times.reduce((a, b) => a + b, 0) / this.results.times.length;
    const minTime = Math.min(...this.results.times);
    const maxTime = Math.max(...this.results.times);

    console.log('\n' + '='.repeat(50));
    console.log('📊 负载测试结果');
    console.log('='.repeat(50));
    console.log(`总请求数: ${this.results.total}`);
    console.log(`成功: ${this.results.success}`);
    console.log(`失败: ${this.results.failed}`);
    console.log(
      `成功率: ${((this.results.success / this.results.total) * 100).toFixed(2)}%`,
    );
    console.log(`总耗时: ${totalTime}ms`);
    console.log(`平均响应时间: ${avgTime.toFixed(2)}ms`);
    console.log(`最快响应: ${minTime}ms`);
    console.log(`最慢响应: ${maxTime}ms`);
    console.log(
      `请求/秒: ${(this.results.total / (totalTime / 1000)).toFixed(2)}`,
    );
  }
}

// 运行负载测试
if (require.main === module) {
  const test = new LoadTest(3000);

  test
    .runLoadTest({
      requests: 1000,
      concurrency: 100,
      path: '/api/health',
    })
    .catch(console.error);
}

module.exports = LoadTest;
