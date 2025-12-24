#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

async function cleanup() {
  console.log('🧹 清理残留进程...');

  try {
    // 获取所有Node进程
    const { stdout } = await execPromise('tasklist | findstr node');
    console.log('当前运行的Node进程:');
    console.log(stdout);

    // 询问是否结束所有进程
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('是否结束所有Node进程？(y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        console.log('正在结束Node进程...');
        try {
          await execPromise('taskkill /F /IM node.exe');
          console.log('✅ 所有Node进程已结束');
        } catch (error) {
          console.log('⚠️  没有找到运行的Node进程');
        }
      } else {
        console.log('跳过清理进程');
      }

      rl.close();

      // 删除可能锁定的文件
      console.log('清理临时文件...');
      const fs = require('fs');
      const files = ['performance-report.html', 'stress-report.html'];
      files.forEach((file) => {
        if (fs.existsSync(file)) {
          console.log(`删除 ${file}`);
          fs.unlinkSync(file);
        }
      });

      console.log('✅ 清理完成');
      process.exit(0);
    });
  } catch (error) {
    console.log('清理过程中出错:', error.message);
    process.exit(1);
  }
}

cleanup();
