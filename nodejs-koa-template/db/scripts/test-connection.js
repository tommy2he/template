/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MongoClient } = require('mongodb');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

// 从环境变量或 .env 文件获取配置
function getEnvValue(key, defaultValue) {
  // 1. 检查环境变量
  if (process.env[key]) {
    return process.env[key];
  }

  // 2. 尝试从 .env 文件读取
  try {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=', 2);
          if (parts[0].trim() === key && parts.length === 2) {
            return parts[1].trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  } catch (error) {
    console.warn(`无法读取 .env 文件: ${error.message}`);
  }

  // 3. 返回默认值
  return defaultValue;
}

async function testConnection() {
  console.log('🔍 测试MongoDB数据库连接');
  console.log('='.repeat(50));

  // 从配置获取连接字符串
  const appUri = getEnvValue(
    'MONGODB_URI',
    'mongodb://koa_user:koa_password@localhost:27018/koa_template_dev',
  );

  const adminUri = getEnvValue(
    'MONGODB_ADMIN_URI',
    'mongodb://admin:secret@localhost:27018/admin',
  );

  const testCases = [
    {
      name: '应用数据库连接',
      uri: appUri,
      database: 'koa_template_dev',
    },
    {
      name: '管理员数据库连接',
      uri: adminUri,
      database: 'admin',
    },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    console.log(`📊 ${testCase.name}:`);
    console.log(`   URI: ${testCase.uri.replace(/:[^:]*@/, ':****@')}`);

    const client = new MongoClient(testCase.uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    try {
      const startTime = Date.now();
      await client.connect();
      const connectionTime = Date.now() - startTime;

      console.log(`   ✅ 连接成功 (${connectionTime}ms)`);

      const db = client.db(testCase.database);

      // Ping测试
      const pingStart = Date.now();
      await db.command({ ping: 1 });
      const pingTime = Date.now() - pingStart;
      console.log(`   ✅ Ping响应 (${pingTime}ms)`);

      // 获取数据库信息
      const stats = await db.stats();
      console.log(`   📁 数据库: ${stats.db}`);
      console.log(`   📊 集合数: ${stats.collections}`);
      console.log(`   📈 文档数: ${stats.objects}`);
      console.log(
        `   💾 存储: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`,
      );

      // 列出集合
      const collections = await db.listCollections().toArray();
      console.log(`   📋 集合列表 (${collections.length}个):`);
      if (collections.length > 0) {
        collections.slice(0, 5).forEach((col) => {
          console.log(`      - ${col.name} (${col.type})`);
        });
        if (collections.length > 5) {
          console.log(`      ... 还有 ${collections.length - 5} 个集合`);
        }
      }
    } catch (error) {
      console.log(`   ❌ 连接失败: ${error.message}`);
      allPassed = false;
    } finally {
      await client.close();
      console.log('');
    }
  }

  // 总结
  console.log('='.repeat(50));
  if (allPassed) {
    console.log('✅ 所有数据库连接测试通过！');
  } else {
    console.log('❌ 部分数据库连接测试失败');
    console.log('\n建议检查:');
    console.log('  1. Docker容器是否运行: docker-compose ps');
    console.log('  2. 容器日志: docker-compose logs mongodb');
    console.log('  3. 连接字符串是否正确');
  }
  console.log('='.repeat(50));

  return allPassed;
}

// 如果直接运行此脚本
if (require.main === module) {
  testConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('测试过程中出错:', error);
      process.exit(1);
    });
}

// 导出配置获取函数，供其他模块使用
module.exports = {
  testConnection,
  getEnvValue,
};
