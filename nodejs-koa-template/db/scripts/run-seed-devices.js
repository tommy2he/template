/* eslint-disable no-console */
// 设备种子数据专用脚本 - 调用主种子脚本运行设备数据
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runSeeds } = require('./seed');

async function runDeviceSeed() {
  console.log('🚀 运行设备种子数据');
  console.log('='.repeat(50));

  // 调用主种子脚本，只运行设备集合
  await runSeeds({
    collection: 'devices',
    drop: process.argv.includes('--drop'),
    force: process.argv.includes('--force'),
  });
}

// 命令行参数解析
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🚀 设备种子脚本');
  console.log('='.repeat(50));
  console.log('专门用于插入设备数据，自动加载 db/seeds/seed-devices.js');
  console.log('');
  console.log('使用方法: node db/scripts/run-seed-devices.js [选项]');
  console.log('');
  console.log('选项:');
  console.log('  --drop     删除现有设备数据并重新插入');
  console.log('  --force    强制在生产环境运行');
  console.log('  --help, -h 显示帮助信息');
  console.log('');
  console.log('示例:');
  console.log(
    '  node db/scripts/run-seed-devices.js            # 插入设备数据',
  );
  console.log(
    '  node db/scripts/run-seed-devices.js --drop     # 删除并重新插入设备数据',
  );
  console.log('');
  process.exit(0);
}

// 运行种子
if (require.main === module) {
  runDeviceSeed().catch((error) => {
    console.error('设备种子脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runDeviceSeed };
