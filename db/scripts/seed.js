/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MongoClient } = require('mongodb');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getEnvValue } = require('./test-connection');

// 加载所有种子数据
function loadSeeds() {
  const seedsDir = path.join(__dirname, '..', 'seeds');
  const seeds = {};

  if (!fs.existsSync(seedsDir)) {
    console.log('📁 创建种子目录...');
    fs.mkdirSync(seedsDir, { recursive: true });
    return seeds;
  }

  const seedFiles = fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith('.js'));

  seedFiles.forEach((file) => {
    const seedName = file.replace('.js', '');
    const seedPath = path.join(seedsDir, file);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      seeds[seedName] = require(seedPath);
      console.log(`📄 加载种子文件: ${file}`);
    } catch (error) {
      console.error(`❌ 加载种子文件 ${file} 失败:`, error.message);
    }
  });

  return seeds;
}

// 运行种子数据
async function runSeeds(options = {}) {
  const { drop = false, force = false, collection = null } = options;

  console.log('🌱 开始数据库种子数据');
  console.log('='.repeat(50));

  // 检查环境
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production' && !force) {
    console.log('❌ 生产环境禁止运行种子数据，除非使用 --force 参数');
    console.log('   请检查你是否真的要在生产环境运行种子数据');
    console.log('   使用: node db/scripts/seed.js --force');
    return;
  }

  // 获取连接字符串
  const adminUri = getEnvValue(
    'MONGODB_ADMIN_URI',
    'mongodb://admin:secret@localhost:27017/admin',
  );

  const client = new MongoClient(adminUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db('koa_template_dev');

    // 加载所有种子数据
    const seeds = loadSeeds();
    let seedEntries = Object.entries(seeds);

    // 如果指定了特定集合，只处理该集合
    if (collection) {
      const seedKey = `seed-${collection}`;
      if (seeds[seedKey]) {
        seedEntries = [[seedKey, seeds[seedKey]]];
        console.log(`🎯 只运行指定集合: ${collection}`);
      } else {
        console.log(`❌ 未找到集合 ${collection} 的种子数据`);
        return;
      }
    }

    const seedCount = seedEntries.length;

    if (seedCount === 0) {
      console.log('⚠️  没有找到种子文件');
      console.log('   在 db/seeds/ 目录下创建 .js 文件');
      console.log('   例如: db/seeds/seed-devices.js');
      return;
    }

    console.log(`📋 找到 ${seedCount} 个种子文件`);

    // 处理每个种子
    for (const [seedName, seedData] of seedEntries) {
      const collectionName = seedName.replace('seed-', '');
      console.log(`\n🔄 运行种子: ${seedName}`);

      // 检查集合是否存在
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map((col) => col.name);

      // 如果指定了 drop 选项，先删除集合
      if (drop && collectionNames.includes(collectionName)) {
        console.log(`   🗑️  删除集合: ${collectionName}`);
        await db.collection(collectionName).drop();
        console.log(`   ✅ 集合已删除`);
      }

      // 检查集合是否存在
      if (!collectionNames.includes(collectionName)) {
        console.log(`   📁 创建集合: ${collectionName}`);
        await db.createCollection(collectionName);
      }

      // 获取当前集合
      const currentCollection = db.collection(collectionName);

      // 检查是否已有数据
      const count = await currentCollection.countDocuments();
      if (count > 0 && !drop) {
        console.log(`   ⏭️  集合 ${collectionName} 已有 ${count} 条数据，跳过`);
        console.log(`      使用 --drop 参数删除现有数据并重新插入`);
        continue;
      }

      // 插入种子数据
      if (Array.isArray(seedData) && seedData.length > 0) {
        console.log(`   📝 插入 ${seedData.length} 条数据到 ${collectionName}`);

        // 为数据添加时间戳
        const dataWithTimestamps = seedData.map((item) => ({
          ...item,
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date(),
        }));

        const result = await currentCollection.insertMany(dataWithTimestamps);
        console.log(`   ✅ 插入完成: ${result.insertedCount} 条`);
      } else {
        console.log(`   ⚠️  种子数据为空或格式错误`);
      }
    }

    // 如果是设备集合，创建索引
    if (!collection || collection === 'devices') {
      console.log('\n🔍 创建设备索引...');
      const deviceIndexes = await db.collection('devices').indexes();
      const indexNames = deviceIndexes.map((idx) => idx.name);

      const requiredIndexes = [
        { key: { deviceId: 1 }, options: { unique: true, name: 'deviceId_1' } },
        { key: { status: 1 }, options: { name: 'status_1' } },
        { key: { lastSeen: -1 }, options: { name: 'lastSeen_-1' } },
        { key: { tags: 1 }, options: { name: 'tags_1' } },
      ];

      for (const index of requiredIndexes) {
        if (!indexNames.includes(index.options.name)) {
          console.log(`   📊 创建索引: ${index.options.name}`);
          await db.collection('devices').createIndex(index.key, index.options);
          console.log(`   ✅ 索引创建完成: ${index.options.name}`);
        } else {
          console.log(`   ⏭️  索引已存在: ${index.options.name}`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));

    // 显示统计数据
    const devicesCount = await db.collection('devices').countDocuments();
    const onlineDevices = await db
      .collection('devices')
      .countDocuments({ status: 'online' });
    const offlineDevices = await db
      .collection('devices')
      .countDocuments({ status: 'offline' });

    console.log('📊 数据库统计:');
    console.log(`   设备总数: ${devicesCount}`);
    console.log(`   在线设备: ${onlineDevices}`);
    console.log(`   离线设备: ${offlineDevices}`);
    console.log(`   在线率: ${devicesCount > 0 ? Math.round((onlineDevices / devicesCount) * 100) : 0}%`);

    console.log('='.repeat(50));
    console.log('✅ 种子数据执行完成');
    console.log('\n💡 提示:');
    console.log('   查看数据: npm run db:app-shell');
    console.log('   删除数据: node db/scripts/seed.js --drop --collection=devices');
    console.log('   只运行特定集合: node db/scripts/seed.js --collection=devices');
  } catch (error) {
    console.error('❌ 种子过程出错:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    drop: args.includes('--drop'),
    force: args.includes('--force'),
    help: args.includes('--help') || args.includes('-h'),
  };

  // 解析 --collection 参数
  const collectionIndex = args.findIndex(arg => arg.startsWith('--collection='));
  if (collectionIndex !== -1) {
    options.collection = args[collectionIndex].split('=')[1];
  }

  if (options.help) {
    console.log('🌱 数据库种子脚本');
    console.log('='.repeat(50));
    console.log('使用方法: node db/scripts/seed.js [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --drop               删除现有数据并重新插入');
    console.log('  --force              强制在生产环境运行');
    console.log('  --collection=<name>  只运行指定集合的种子');
    console.log('  --help, -h           显示帮助信息');
    console.log('');
    console.log('示例:');
    console.log('  node db/scripts/seed.js                       # 运行所有种子');
    console.log('  node db/scripts/seed.js --drop                # 删除并重新插入所有');
    console.log('  node db/scripts/seed.js --collection=devices  # 只运行设备种子');
    console.log('  node db/scripts/seed.js --drop --collection=devices # 删除并重新插入设备数据');
    console.log('  node db/scripts/seed.js --force               # 强制生产环境运行');
    console.log('');
    process.exit(0);
  }

  return options;
}

// 如果直接运行此脚本
if (require.main === module) {
  const options = parseArgs();
  runSeeds(options).catch((error) => {
    console.error('种子脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runSeeds, loadSeeds };