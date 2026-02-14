// scripts/dev/ts/test-status-quick.ts - 快速测试，不使用数据库
/* eslint-disable no-console */
// eslint-disable-next-line

// 在脚本开头注册模块别名
import 'module-alias/register';

// 然后使用路径别名导入
import { StatusCalculator } from '@/services/status-calculator';

// import { StatusCalculator } from '../../../src/services/status-calculator';

// 以下删除的代码暂时保留，这是一个可供学习的历史记录
// scripts/dev/ts/test-status-quick.ts - 快速测试，不使用数据库
// eslint-disable-next-line
// const path = require('path');

// // 因为这是一个独立脚本，我们需要正确设置模块路径
// const projectRoot = path.resolve(__dirname, '../../..');

// // 动态导入状态计算服务（注意：我们需要先设置好路径别名，或者使用相对路径）
// // 由于我们的项目使用了路径别名，我们需要先注册别名
// // eslint-disable-next-line
// require('module-alias/register');

// // 然后导入我们的服务
// // eslint-disable-next-line
// const { StatusCalculator } = require(
//   path.join(projectRoot, 'src/services/status-calculator'),
// );

// 使用相对路径导入 StatusCalculator
// eslint-disable-next-line
// const { StatusCalculator } = require(
//   path.resolve(__dirname, '../../../src/services/status-calculator'),
// );

// 模拟CPE数据用于测试
const mockCpes = [
  {
    _id: '1',
    cpeId: 'cpe-test-001',
    lastSeen: new Date(Date.now() - 10000), // 10秒前
    onlineStatus: undefined as any,
  },
  {
    _id: '2',
    cpeId: 'cpe-test-002',
    lastSeen: new Date(Date.now() - 3600000), // 1小时前
    onlineStatus: undefined as any,
  },
  {
    _id: '3',
    cpeId: 'cpe-test-003',
    lastSeen: new Date(Date.now() - 5000), // 5秒前
    onlineStatus: undefined as any,
  },
];

async function quickTest() {
  console.log('⚡ 快速测试：状态计算逻辑');
  console.log('='.repeat(40));

  mockCpes.forEach((cpe, index) => {
    const status = StatusCalculator.calculateOnlineStatus(cpe as any);
    const timeDiff = Math.floor((Date.now() - cpe.lastSeen.getTime()) / 1000);
    console.log(`CPE ${index + 1}: ${cpe.cpeId}`);
    console.log(`   最后活动: ${timeDiff}秒前`);
    console.log(`   在线状态: ${status}`);
    console.log('---');
  });

  console.log('✅ 快速测试完成！');
}

quickTest().catch(console.error);
