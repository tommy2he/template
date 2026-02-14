/* eslint-disable no-console */
// scripts/dev/ts/test-status-calculator.ts - 修复为CommonJS版本
import path from 'path';

// 设置模块别名（非常重要！）
import 'module-alias/register';

// 由于这是一个独立脚本，我们手动设置路径别名
import moduleAlias from 'module-alias';
const projectRoot = path.resolve(__dirname, '../../../');
moduleAlias.addAliases({
  '@': path.join(projectRoot, 'src'),
  '@config': path.join(projectRoot, 'src/config'),
  '@services': path.join(projectRoot, 'src/services'),
  '@db': path.join(projectRoot, 'src/db'),
});

// 现在可以正常导入
import config from '@/config';
import { StatusCalculator } from '@/services/status-calculator';
import db from '@/db/connection';

async function main() {
  console.log('🧪 开发测试：状态计算服务');
  console.log('='.repeat(50));

  try {
    // 1. 连接数据库
    console.log('🔗 连接数据库...');
    await db.connect();

    // 2. 显示配置信息
    console.log('⚙️  配置信息:');
    console.log(`   - 批量大小: ${config.cpeManagement.refreshBatchSize}`);
    console.log(
      `   - 在线超时: ${config.cpeManagement.onlineTimeout}ms (${config.cpeManagement.onlineTimeout / 60000}分钟)`,
    );
    console.log(`   - 刷新模式: ${config.cpeManagement.statusRefreshMode}`);
    console.log(
      `   - 启动阈值: ${config.cpeManagement.bootThreshold}ms (${config.cpeManagement.bootThreshold / 60000}分钟)`,
    );

    // 3. 获取当前状态
    console.log('\n📊 获取当前状态统计...');
    const stats = await StatusCalculator.getStatusStats();
    console.log(`   总设备: ${stats.total}`);
    console.log(
      `   在线: ${stats.online} (${stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}%)`,
    );
    console.log(
      `   离线: ${stats.offline} (${stats.total > 0 ? Math.round((stats.offline / stats.total) * 100) : 0}%)`,
    );
    if (stats.lastRefresh) {
      const lastRefreshAgo = Math.floor(
        (Date.now() - stats.lastRefresh.getTime()) / 60000,
      );
      console.log(
        `   最后刷新: ${stats.lastRefresh.toISOString()} (${lastRefreshAgo}分钟前)`,
      );
    }

    // 4. 运行状态计算
    console.log('\n🔄 开始批量状态计算...');
    const startTime = Date.now();
    const result = await StatusCalculator.calculateBatchPaginated();
    const endTime = Date.now();

    // 5. 显示结果
    console.log('\n✅ 状态计算完成！');
    console.log('='.repeat(50));
    console.log('📊 计算结果摘要:');
    console.log(`   总设备: ${result.total}`);
    console.log(`   已处理: ${result.processed}`);
    console.log(
      `   在线: ${result.online} (${result.total > 0 ? Math.round((result.online / result.total) * 100) : 0}%)`,
    );
    console.log(
      `   离线: ${result.offline} (${result.total > 0 ? Math.round((result.offline / result.total) * 100) : 0}%)`,
    );
    console.log(`   批次大小: ${result.batchSize}`);
    console.log(`   总页数: ${result.pages}`);
    console.log(`   耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒`);
    console.log(
      `   速度: ${result.total > 0 ? ((endTime - startTime) / result.total).toFixed(2) : 0}ms/设备`,
    );
    console.log(
      `   设备/秒: ${result.total > 0 ? (result.total / ((endTime - startTime) / 1000)).toFixed(2) : 0}`,
    );
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    // 6. 断开数据库连接
    await db.disconnect();
    console.log('\n👋 数据库连接已断开');
  }
}

// 直接运行
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 开发测试完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 未处理的错误:', error);
      process.exit(1);
    });
}

export default main;
