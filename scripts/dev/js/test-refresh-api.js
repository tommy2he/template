// 测试脚本
/* eslint-disable no-console */
/* eslint-disable-next-line */
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3300';

async function testAPI() {
  console.log('🧪 测试状态刷新API...\n');

  // 1. 检查是否可以刷新
  console.log('1. 检查刷新状态:');
  const checkRes = await fetch(`${BASE_URL}/api/admin/refresh-tasks/check`);
  const checkData = await checkRes.json();
  console.log(JSON.stringify(checkData, null, 2));

  // 2. 启动刷新任务
  console.log('\n2. 启动刷新任务 (normal模式):');
  const startRes = await fetch(`${BASE_URL}/api/admin/refresh-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'normal', operator: 'tester' }),
  });
  const startData = await startRes.json();
  console.log(JSON.stringify(startData, null, 2));

  if (startData.success) {
    const taskId = startData.data.taskId;

    // 3. 获取任务详情
    console.log(`\n3. 获取任务详情 (${taskId}):`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待1秒
    const taskRes = await fetch(
      `${BASE_URL}/api/admin/refresh-tasks/${taskId}`,
    );
    const taskData = await taskRes.json();
    console.log(JSON.stringify(taskData, null, 2));
  }

  // 4. 获取任务列表
  console.log('\n4. 获取任务列表:');
  const listRes = await fetch(`${BASE_URL}/api/admin/refresh-tasks?limit=5`);
  const listData = await listRes.json();
  console.log(JSON.stringify(listData, null, 2));
}

testAPI().catch(console.error);
