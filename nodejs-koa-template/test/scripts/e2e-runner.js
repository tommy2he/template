#!/usr/bin/env node
/**
 * E2E 测试运行器 - Windows 兼容版
 * 用法: npm run test:e2e
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// 注释掉测试环境的dotenv配置，使用默认环境
// dotenv.config({ path: path.join(__dirname, '../../.env.test') });
// 改为加载默认环境变量（不指定文件）
dotenv.config();

console.log('🚀 启动 E2E 测试套件');
console.log('='.repeat(50));

// 检测操作系统
const isWindows = process.platform === 'win32';

// Windows 兼容的 spawn 函数
function spawnCommand(command, args, options = {}) {
  if (isWindows) {
    // 在 Windows 上使用 cmd.exe
    return spawn('cmd.exe', ['/c', command, ...args], {
      ...options,
      shell: true,
    });
  } else {
    return spawn(command, args, {
      ...options,
      shell: true,
    });
  }
}

// 检查应用是否在运行
function isAppRunning() {
  try {
    const checkCommand = isWindows
      ? 'curl -s http://localhost:3300/api/health 2>nul'
      : 'curl -s http://localhost:3300/api/health > /dev/null 2>&1';

    execSync(checkCommand, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// 启动测试应用 - 移除 NODE_ENV=test
function startTestApp() {
  console.log('🔧 启动测试应用...');

  return spawnCommand('npm', ['run', 'dev'], {
    stdio: 'pipe',
    env: {
      ...process.env, // 使用当前环境变量，不覆盖 NODE_ENV
      PORT: '3300',
    },
  });
}

// 运行 E2E 测试 - 移除 NODE_ENV=test
function runE2ETests() {
  console.log('🧪 运行 E2E 测试...');

  try {
    const result = execSync(
      'npx jest test/e2e/device-api.e2e.test.ts --verbose',
      {
        stdio: 'inherit',
        env: {
          ...process.env, // 使用当前环境变量
        },
      },
    );

    return true;
  } catch (error) {
    console.error('❌ E2E 测试失败');
    return false;
  }
}

// 生成测试报告
function generateReport() {
  const reportDir = path.join(__dirname, '../../reports/e2e');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportFile = path.join(reportDir, `e2e-report-${Date.now()}.txt`);
  const reportContent = `
E2E 测试报告
生成时间: ${new Date().toISOString()}
测试环境: ${process.env.NODE_ENV || '默认环境'}
应用地址: http://localhost:3300
操作系统: ${process.platform}

✅ E2E 测试套件执行完成
  `;

  fs.writeFileSync(reportFile, reportContent);
  console.log(`📊 测试报告已生成: ${reportFile}`);
}

// 等待应用启动
function waitForApp(timeout = 30000, interval = 1000) {
  console.log('⏳ 等待应用启动...');

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (isAppRunning()) {
        console.log('✅ 应用启动成功');
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`应用启动超时 (${timeout}ms)`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

// 主函数
async function main() {
  let appProcess = null;
  let testsPassed = false;

  try {
    // 1. 检查或启动应用
    if (!isAppRunning()) {
      console.log('⚠️  应用未运行，正在启动...');
      appProcess = startTestApp();

      // 等待应用启动
      await waitForApp(30000, 1000);
    } else {
      console.log('✅ 应用已在运行');
    }

    // 2. 运行测试
    testsPassed = runE2ETests();

    // 3. 生成报告
    if (testsPassed) {
      generateReport();
    }
  } catch (error) {
    console.error('💥 E2E 测试运行器出错:', error.message);
    testsPassed = false;
  } finally {
    // 4. 清理
    if (appProcess) {
      console.log('🛑 停止测试应用...');
      if (isWindows) {
        // Windows 上需要杀死整个进程树
        execSync(`taskkill /pid ${appProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        appProcess.kill('SIGTERM');
      }
    }

    console.log('='.repeat(50));
    console.log(testsPassed ? '🎉 E2E 测试全部通过!' : '❌ E2E 测试失败');
    process.exit(testsPassed ? 0 : 1);
  }
}

// 执行
main().catch((error) => {
  console.error('💥 致命错误:', error.message);
  process.exit(1);
});
