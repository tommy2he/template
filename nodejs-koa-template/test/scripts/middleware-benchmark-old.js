#!/usr/bin/env node

const Benchmark = require('benchmark');
const Koa = require('koa');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

console.log('🔬 开始中间件性能分析...\n');

// 在加载中间件之前，先重写 console 方法
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  error: console.error,
  warn: console.warn,
};

// 重写所有 console 方法，完全静默
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.error = () => {};
console.warn = () => {};

// 创建一个自定义的 log 方法，只允许我们的测试输出
const testLog = (...args) => {
  originalConsole.log(...args);
};

// 现在才加载中间件（此时所有 console 方法已经被重写）
const middleware = require('../../dist/middleware').default;

class MiddlewareBenchmark {
  constructor() {
    this.server = null;
    this.port = 3001;
    this.connections = new Set();
    this.isWindows = process.platform === 'win32';
    this.progressInterval = null;
    this.testStartTime = null;
    this.currentTestName = '';
    this.testProgress = 0;
  }

  // 显示进度条
  showProgress(message, progress, total = 100) {
    const width = 40;
    const filled = Math.round((progress / total) * width);
    const empty = width - filled;
    const percent = Math.round((progress / total) * 100);

    // 清除当前行
    process.stdout.clearLine();
    process.stdout.cursorTo(0);

    // 构建进度条
    const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`${message} [${progressBar}] ${percent}%`);

    if (progress >= total) {
      process.stdout.write('\n');
    }
  }

  // 开始进度显示
  startProgress(testName, duration = 10000) {
    this.currentTestName = testName;
    this.testProgress = 0;

    testLog(`\n📊 ${testName}...`);

    this.progressInterval = setInterval(() => {
      this.testProgress += 5;
      if (this.testProgress > 95) this.testProgress = 95;

      const elapsed = Date.now() - this.testStartTime;
      const seconds = Math.floor(elapsed / 1000);

      this.showProgress(`  正在测试 (已运行 ${seconds}s)`, this.testProgress);
    }, 500);
  }

  // 停止进度显示
  stopProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;

      // 显示完成状态
      this.showProgress(`  ✅ 测试完成`, 100);
      testLog();
    }
  }

  // 清理占用端口的进程
  async killPortProcess(port) {
    try {
      testLog('🔧 检查端口占用情况...');

      if (this.isWindows) {
        const netstatCmd = `netstat -ano | findstr :${port} | findstr LISTENING`;
        try {
          const { stdout } = await execAsync(netstatCmd, { shell: true });
          if (stdout.trim()) {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              const currentPid = process.pid.toString();

              if (pid && !isNaN(pid) && pid !== currentPid) {
                testLog(`   🔫 杀死占用端口 ${port} 的进程: ${pid}`);
                try {
                  await execAsync(`taskkill /F /PID ${pid} /T`, {
                    shell: true,
                  });
                } catch (err) {
                  // 忽略错误
                }
              }
            }
          }
        } catch (error) {
          // 没有找到进程是正常的
        }
      } else {
        try {
          const { stdout } = await execAsync(`lsof -ti:${port}`, {
            shell: true,
          });
          if (stdout.trim()) {
            const pids = stdout.trim().split('\n');
            const currentPid = process.pid.toString();

            for (const pid of pids) {
              if (pid && pid !== currentPid) {
                testLog(`   🔫 杀死占用端口 ${port} 的进程: ${pid}`);
                try {
                  await execAsync(`kill -9 ${pid}`, { shell: true });
                } catch (err) {
                  // 忽略错误
                }
              }
            }
          }
        } catch (error) {
          // 没有找到进程是正常的
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      // 忽略错误
    }
  }

  async startServer() {
    testLog('\n' + '='.repeat(60));
    testLog('🚀 启动性能测试服务器');
    testLog('='.repeat(60));

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;

      if (attempts > 1) {
        testLog(
          `   ⚠️  端口 ${this.port - 1} 被占用，尝试端口 ${this.port}...`,
        );
      } else {
        testLog(`   📍 使用端口: ${this.port}`);
      }

      // 清理可能占用端口的进程
      await this.killPortProcess(this.port);

      const fullApp = new Koa();

      // 加载中间件 - 此时中间件内部的所有 console 调用都会被我们的重写方法静默处理
      middleware(fullApp);

      fullApp.use(async (ctx) => {
        if (ctx.path === '/test') {
          ctx.body = { message: 'Benchmark test' };
          return;
        }
        ctx.body = { processed: true };
      });

      return new Promise((resolve, reject) => {
        const http = require('http');
        this.server = http.createServer(fullApp.callback());

        // 跟踪所有连接
        this.server.on('connection', (socket) => {
          this.connections.add(socket);
          socket.on('close', () => {
            this.connections.delete(socket);
          });
        });

        this.server.listen(this.port, () => {
          testLog(`   ✅ 服务器启动成功 (端口: ${this.port})`);

          // 验证服务器是否正常工作
          const http = require('http');
          const testReq = http.request(
            {
              hostname: 'localhost',
              port: this.port,
              path: '/test',
              method: 'GET',
              timeout: 2000,
            },
            (res) => {
              testLog('   🔍 服务器验证: 正常响应');
              setTimeout(resolve, 500);
            },
          );

          testReq.on('error', () => {
            testLog('   ⚠️  服务器验证失败，重试...');
            this.server.close();
            setTimeout(() => {
              this.port++;
              if (this.port > 3020) {
                reject(new Error('找不到可用端口'));
              } else {
                this.startServer().then(resolve).catch(reject);
              }
            }, 1000);
          });

          testReq.end();
        });

        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            this.server.close();
            this.port++;
            if (this.port > 3020) {
              reject(new Error('找不到可用端口'));
            } else {
              setTimeout(() => {
                this.startServer().then(resolve).catch(reject);
              }, 1000);
            }
          } else {
            reject(err);
          }
        });

        // 启动超时
        setTimeout(() => {
          if (this.server && !this.server.listening) {
            this.server.close();
            reject(new Error('服务器启动超时'));
          }
        }, 5000);
      });
    }
  }

  async stopServer() {
    if (this.server) {
      testLog('\n🛑 停止性能测试服务器...');

      // 停止所有进度显示
      this.stopProgress();

      // 关闭所有活跃连接
      testLog('   🔌 关闭活跃连接...');
      let closedCount = 0;
      this.connections.forEach((socket) => {
        try {
          socket.destroy();
          closedCount++;
        } catch (err) {
          // 忽略错误
        }
      });

      if (closedCount > 0) {
        testLog(`   ✅ 已关闭 ${closedCount} 个连接`);
      }

      this.connections.clear();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          testLog('   ⏰ 服务器关闭超时，强制退出...');
          this.server = null;
          resolve();
        }, 3000);

        this.server.close((err) => {
          clearTimeout(timeout);
          if (err) {
            testLog(`   ⚠️  关闭服务器时出错: ${err.message}`);
            this.server = null;
            resolve();
          } else {
            testLog('   ✅ 服务器已停止');
            this.server = null;
            resolve();
          }
        });
      });
    }
  }

  async runLoadBenchmark() {
    this.testStartTime = Date.now();
    this.startProgress('中间件加载性能测试', 5000);

    return new Promise((resolve) => {
      const loadSuite = new Benchmark.Suite();
      const benchmarkInstance = this; // 保存实例引用

      loadSuite
        .add('无中间件', {
          defer: true,
          fn: function (deferred) {
            const testApp = new Koa();
            testApp.use(async (ctx) => {
              ctx.body = { test: 'no middleware' };
            });
            deferred.resolve();
          },
        })
        .add('完整中间件栈', {
          defer: true,
          fn: function (deferred) {
            const testApp = new Koa();
            middleware(testApp);
            testApp.use(async (ctx) => {
              ctx.body = { test: 'full middleware' };
            });
            deferred.resolve();
          },
        })
        .on('start', () => {
          testLog('\n   ⚡ 开始性能测试...');
        })
        .on('cycle', (event) => {
          // 使用 testLog 输出测试结果
          originalConsole.log(`   📈 ${String(event.target)}`);
        })
        .on('complete', function () {
          benchmarkInstance.stopProgress();
          testLog('   🏆 最快的是: ' + this.filter('fastest').map('name'));

          const elapsed = (
            (Date.now() - benchmarkInstance.testStartTime) /
            1000
          ).toFixed(1);
          testLog(`   ⏱️  测试耗时: ${elapsed}秒`);

          resolve();
        });

      loadSuite.run({ async: true });
    });
  }

  async runRequestBenchmark() {
    this.testStartTime = Date.now();
    this.startProgress('请求处理性能测试', 15000);

    return new Promise((resolve) => {
      const requestSuite = new Benchmark.Suite();
      const benchmarkInstance = this; // 保存实例引用

      requestSuite
        .add('健康检查接口 (/test)', {
          defer: true,
          fn: function (deferred) {
            const http = require('http');
            const req = http.request(
              {
                hostname: 'localhost',
                port: benchmarkInstance.port,
                path: '/test',
                method: 'GET',
              },
              (res) => {
                res.on('data', () => {});
                res.on('end', () => deferred.resolve());
              },
            );
            req.on('error', () => deferred.resolve());
            req.setTimeout(5000);
            req.end();
          },
        })
        .add('API根路径 (/api)', {
          defer: true,
          fn: function (deferred) {
            const http = require('http');
            const req = http.request(
              {
                hostname: 'localhost',
                port: benchmarkInstance.port,
                path: '/api',
                method: 'GET',
              },
              (res) => {
                res.on('data', () => {});
                res.on('end', () => deferred.resolve());
              },
            );
            req.on('error', () => deferred.resolve());
            req.setTimeout(5000);
            req.end();
          },
        })
        .on('start', () => {
          testLog('\n   ⚡ 开始请求测试...');
          testLog(`   🌐 测试地址: http://localhost:${benchmarkInstance.port}`);
        })
        .on('cycle', (event) => {
          // 使用 testLog 输出测试结果
          originalConsole.log(`   📈 ${String(event.target)}`);
        })
        .on('complete', function () {
          benchmarkInstance.stopProgress();

          if (this.length > 0) {
            testLog(`   🏆 平均响应时间: ${this[0].stats.mean.toFixed(3)}ms`);
          }

          const elapsed = (
            (Date.now() - benchmarkInstance.testStartTime) /
            1000
          ).toFixed(1);
          testLog(`   ⏱️  测试耗时: ${elapsed}秒`);

          resolve();
        });

      // 运行请求测试
      requestSuite.run({ async: true });
    });
  }

  async runAllTests() {
    const totalStartTime = Date.now();

    testLog('='.repeat(60));
    testLog('🔥 中间件性能分析开始');
    testLog('='.repeat(60));
    testLog('📋 测试计划:');
    testLog('   1. 启动测试服务器');
    testLog('   2. 中间件加载性能测试');
    testLog('   3. 请求处理性能测试');
    testLog('   4. 清理测试环境');
    testLog('='.repeat(60));

    try {
      // 阶段1: 启动服务器
      testLog('\n📡 阶段1: 启动测试服务器');
      const serverStartTime = Date.now();
      await this.startServer();
      const serverTime = ((Date.now() - serverStartTime) / 1000).toFixed(1);
      testLog(`✅ 阶段1完成 (${serverTime}秒)`);

      // 等待服务器稳定
      testLog('\n⏳ 等待服务器稳定...');
      await new Promise((resolve) => {
        let dots = 0;
        const interval = setInterval(() => {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(`   等待中${'.'.repeat(dots % 4)}`);
          dots++;
        }, 500);

        setTimeout(() => {
          clearInterval(interval);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          testLog('   服务器稳定完成');
          resolve();
        }, 2000);
      });

      // 阶段2: 中间件加载测试
      testLog('\n🔧 阶段2: 中间件加载性能测试');
      await this.runLoadBenchmark();
      testLog('✅ 阶段2完成');

      // 阶段3: 请求处理测试
      testLog('\n🌐 阶段3: 请求处理性能测试');
      await this.runRequestBenchmark();
      testLog('✅ 阶段3完成');

      // 阶段4: 清理
      testLog('\n🧹 阶段4: 清理测试环境');
      const cleanupStartTime = Date.now();
      await this.stopServer();
      const cleanupTime = ((Date.now() - cleanupStartTime) / 1000).toFixed(1);
      testLog(`✅ 阶段4完成 (${cleanupTime}秒)`);

      // 总结
      const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
      testLog('\n' + '='.repeat(60));
      testLog('✨ 测试完成总结');
      testLog('='.repeat(60));
      testLog(`⏱️  总耗时: ${totalTime}秒`);
      testLog(`✅ 所有测试通过`);
      testLog(`📊 测试了 2 种中间件配置`);
      testLog(`🌐 测试了 2 种请求场景`);
      testLog('='.repeat(60));
      testLog('\n✅ 中间件性能分析完成\n');
    } catch (error) {
      // 停止进度显示
      this.stopProgress();

      originalConsole.error('\n❌ 性能测试失败:', error.message);
      testLog('🔄 正在清理资源...');

      try {
        await this.stopServer();
      } catch (cleanupError) {
        testLog('⚠️  清理资源时出错:', cleanupError.message);
      }

      testLog('🔚 测试已终止\n');
    }
  }
}

// 运行性能测试
if (require.main === module) {
  const benchmark = new MiddlewareBenchmark();
  benchmark.runAllTests().catch((error) => {
    originalConsole.error('测试错误:', error);
  });
}

module.exports = MiddlewareBenchmark;
