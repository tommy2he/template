/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MongoClient } = require('mongodb');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getEnvValue } = require('./test-connection');

async function runMigrations() {
  console.log('🚀 开始数据库迁移');
  console.log('='.repeat(50));

  // 获取连接字符串
  const adminUri = getEnvValue(
    'MONGODB_ADMIN_URI',
    'mongodb://admin:secret@localhost:27018/admin',
  );

  const client = new MongoClient(adminUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db('koa_template_dev');

    // 创建迁移记录集合
    const migrationsCollection = db.collection('migrations');
    await migrationsCollection.createIndex({ name: 1 }, { unique: true });

    // 获取所有迁移文件
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 创建迁移目录...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.js'))
      .sort(); // 按文件名排序

    console.log(`📋 找到 ${migrationFiles.length} 个迁移文件`);

    // 获取已执行的迁移
    const executedMigrations = await migrationsCollection.find({}).toArray();
    const executedNames = executedMigrations.map((m) => m.name);

    // 执行未执行的迁移
    for (const migrationFile of migrationFiles) {
      if (!executedNames.includes(migrationFile)) {
        console.log(`🔄 执行迁移: ${migrationFile}`);

        const migrationPath = path.join(migrationsDir, migrationFile);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const migration = require(migrationPath);

        try {
          await migration.up(db);

          // 记录迁移执行
          await migrationsCollection.insertOne({
            name: migrationFile,
            executedAt: new Date(),
            success: true,
          });

          console.log(`✅ ${migrationFile} 迁移完成`);
        } catch (error) {
          console.error(`❌ ${migrationFile} 迁移失败:`, error.message);
          throw error;
        }
      } else {
        console.log(`⏭️  跳过已执行的迁移: ${migrationFile}`);
      }
    }

    console.log('='.repeat(50));
    console.log('✅ 所有迁移执行完成');
  } catch (error) {
    console.error('❌ 迁移过程出错:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };
