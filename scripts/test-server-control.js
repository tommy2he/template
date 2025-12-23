#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const readline = require('readline');

// 创建readline接口用于等待回车
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class ServerTester {
  constructor() {
    this.port = 3002;
    this.server = null;
    this.serverPid = null;
  }

  // 检查node进程数
  async countNodeProcesses() {
    return new Promise((resolve) => {
      let command;
      if (process.platform === 'win32') {
        command = 'tasklist /FI "IMAGENAME eq node.exe" /FO CSV';
      } else {
        command = 'ps aux | grep node | grep -v grep';
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ 检查进程失败:', error.message);
          resolve(0);
          return;
        }

        if (process.platform === 'win32') {
          // Windows: CSV格式，每行一个进程
          const lines = stdout.trim().split('\n');
          // 减去标题行
          const count = Math.max(0, lines.length - 1);
          console.log(`📊 当前node.exe进程数: ${count}`);
          resolve(count);
        } else {
          // Linux/Mac: 每行一个进程
          const lines = stdout.trim().split('\n');
          const count = lines.filter((line) => line.includes('node')).length;
          console.log(`📊 当前node进程数: ${count}`);
          resolve(count);
        }
      });
    });
  }

  // 查看详细的进程信息
  async showProcessDetails() {
    console.log('\n🔍 进程详情:');

    let command;
    if (process.platform === 'win32') {
      command = 'tasklist /FI "IMAGENAME eq node.exe" /FO TABLE';
    } else {
      command = 'ps aux | grep node | grep -v grep';
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ 获取进程详情失败');
        return;
      }
      console.log(stdout);
    });
  }

  // 杀死所有node进程（Windows专用方法）
  async killAllNodeProcesses() {
    if (process.platform !== 'win32') {
      console.log('⚠️  此方法仅适用于Windows');
      return;
    }

    console.log('\n💀 尝试杀死所有node.exe进程...');

    try {
      // 使用 taskkill 强制杀死所有node进程
      await new Promise((resolve, reject) => {
        exec('taskkill /F /IM node.exe /T', (error, stdout, stderr) => {
          if (error) {
            // 如果没有进程可杀，会返回错误，但我们可以忽略
            if (error.message.includes('没有运行')) {
              console.log('✅ 没有运行的node进程');
            } else {
              console.log('❌ 杀死进程失败:', error.message);
            }
          } else {
            console.log('✅ 已杀死所有node进程');
          }
          resolve();
        });
      });

      // 等待一段时间确保进程被杀死
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 再次检查进程数
      await this.countNodeProcesses();
    } catch (error) {
      console.log('❌ 清理进程时出错:', error.message);
    }
  }

  // 启动服务器
  async startServer() {
    console.log(`\n🚀 启动测试服务器 (端口: ${this.port})...`);

    return new Promise((resolve, reject) => {
      this.server = spawn('node', [path.join(__dirname, '../dist/index.js')], {
        env: {
          ...process.env,
          PORT: this.port.toString(),
          NODE_ENV: 'production',
          LOG_LEVEL: 'error',
          ENABLE_SWAGGER: 'false',
          JWT_SECRET: 'test_secret_key',
          RATE_LIMIT_ENABLED: 'false',
          RATE_LIMIT_WINDOW_MS: '0',
          RATE_LIMIT_MAX_REQUESTS: '999999',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      // 保存进程PID
      this.serverPid = this.server.pid;
      console.log(`📝 服务器PID: ${this.serverPid}`);

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          console.log('⏰ 服务器启动超时');
          reject(new Error('服务器启动超时'));
        }
      }, 10000);

      this.server.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('服务器输出:', output.trim());

        if (
          output.includes('启动成功') ||
          output.includes('地址:') ||
          output.includes('Server started') ||
          output.includes('listening on port') ||
          output.includes(`:${this.port}`)
        ) {
          clearTimeout(timeout);
          started = true;
          console.log(`✅ 测试服务器已启动在端口 ${this.port}`);
          setTimeout(resolve, 1000);
        }
      });

      this.server.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error('服务器错误输出:', errorOutput.trim());

        // 检查端口占用错误
        if (
          errorOutput.includes('EADDRINUSE') ||
          errorOutput.includes('address already in use')
        ) {
          console.error(`❌ 端口 ${this.port} 被占用`);
          this.port += 1;
          console.log(`🔄 尝试端口 ${this.port}`);
          this.server.kill();
          setTimeout(
            () => this.startServer().then(resolve).catch(reject),
            1000,
          );
        }
      });

      this.server.on('error', (error) => {
        clearTimeout(timeout);
        console.error('启动服务器时发生错误:', error);
        reject(error);
      });

      this.server.on('close', (code) => {
        console.log(`📝 服务器进程关闭，退出码: ${code}`);
      });
    });
  }

  // 方法1: 使用SIGTERM
  async stopServerMethod1() {
    console.log('\n🛑 方法1: 使用SIGTERM停止服务器');
    if (this.server) {
      console.log(`📝 发送SIGTERM到PID: ${this.serverPid}`);
      this.server.kill('SIGTERM');

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⚠️  SIGTERM未生效，尝试SIGKILL');
          this.server.kill('SIGKILL');
          resolve();
        }, 3000);

        this.server.on('close', (code) => {
          clearTimeout(timeout);
          console.log(`✅ 服务器已关闭 (退出码: ${code})`);
          this.server = null;
          this.serverPid = null;
          resolve();
        });
      });
    }
  }

  // 方法2: 使用Windows的taskkill命令
  async stopServerMethod2() {
    console.log('\n🛑 方法2: 使用taskkill命令停止服务器');
    if (this.serverPid) {
      return new Promise((resolve) => {
        exec(
          `taskkill /F /PID ${this.serverPid} /T`,
          (error, stdout, stderr) => {
            if (error) {
              console.log('❌ taskkill失败:', error.message);
            } else {
              console.log('✅ taskkill执行成功');
            }
            this.server = null;
            this.serverPid = null;
            resolve();
          },
        );
      });
    }
  }

  // 方法3: 使用taskkill杀死所有node进程
  async stopServerMethod3() {
    console.log('\n🛑 方法3: 杀死所有node.exe进程');
    await this.killAllNodeProcesses();
    this.server = null;
    this.serverPid = null;
  }

  // 测试流程
  async runTest() {
    console.log('🔧 Windows服务器进程管理测试');
    console.log('='.repeat(50));

    // 1. 初始状态
    console.log('\n📊 初始状态:');
    let initialCount = await this.countNodeProcesses();
    await this.showProcessDetails();

    // 2. 启动服务器
    try {
      await this.startServer();
    } catch (error) {
      console.log('❌ 启动服务器失败:', error.message);
      return;
    }

    // 3. 启动后状态
    console.log('\n📊 服务器启动后:');
    let afterStartCount = await this.countNodeProcesses();
    await this.showProcessDetails();

    // 4. 等待用户输入
    console.log('\n⏸️  服务器正在运行，按回车键停止服务器...');
    await new Promise((resolve) => {
      rl.question('', () => {
        resolve();
      });
    });

    // 5. 停止服务器（让用户选择方法）
    console.log('\n🛑 选择停止方法:');
    console.log('1. SIGTERM (默认)');
    console.log('2. taskkill (按PID)');
    console.log('3. 杀死所有node进程');

    const method = await new Promise((resolve) => {
      rl.question('请输入方法编号 (1-3, 默认1): ', (answer) => {
        resolve(answer.trim() || '1');
      });
    });

    switch (method) {
      case '1':
        await this.stopServerMethod1();
        break;
      case '2':
        await this.stopServerMethod2();
        break;
      case '3':
        await this.stopServerMethod3();
        break;
      default:
        console.log('❌ 无效选项，使用默认方法1');
        await this.stopServerMethod1();
    }

    // 6. 停止后状态
    console.log('\n📊 服务器停止后:');
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒
    let afterStopCount = await this.countNodeProcesses();
    await this.showProcessDetails();

    // 7. 清理并退出
    console.log('\n📈 统计:');
    console.log(`初始进程数: ${initialCount}`);
    console.log(`启动后进程数: ${afterStartCount}`);
    console.log(`停止后进程数: ${afterStopCount}`);

    if (afterStopCount > initialCount) {
      console.log('⚠️  警告: 停止后有残留的node进程');

      const cleanup = await new Promise((resolve) => {
        rl.question('是否清理所有残留的node进程? (y/N): ', (answer) => {
          resolve(answer.trim().toLowerCase() === 'y');
        });
      });

      if (cleanup) {
        await this.killAllNodeProcesses();
      }
    }

    console.log('\n✅ 测试完成');
    rl.close();
    process.exit(0);
  }
}

// 运行测试
if (require.main === module) {
  const tester = new ServerTester();
  tester.runTest().catch((error) => {
    console.error('❌ 测试失败:', error.message);
    rl.close();
    process.exit(1);
  });
}

module.exports = ServerTester;
