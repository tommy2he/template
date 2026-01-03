// koa_template_app/db/migrations/002-update-cpe-schema.js
/* eslint-disable no-console */
module.exports = {
  async up(db) {
    const collectionName = 'cpes';

    console.log('🔄 开始更新CPE集合结构...');

    // 1. 检查集合是否存在，如果不存在则创建
    const collections = await db
      .listCollections({ name: collectionName })
      .toArray();
    if (collections.length === 0) {
      console.log('📁 CPE集合不存在，正在创建...');
      await db.createCollection(collectionName);
    }

    // 2. 重命名字段：rebootCount -> bootCount
    console.log('🔄 重命名字段: rebootCount -> bootCount...');
    try {
      await db
        .collection(collectionName)
        .updateMany(
          { rebootCount: { $exists: true } },
          { $rename: { rebootCount: 'bootCount' } },
        );
      console.log('✅ 字段重命名完成');
    } catch (error) {
      console.log('⚠️  重命名字段可能已完成或不存在:', error.message);
    }

    // 3. 添加新字段的默认值（如果字段不存在）
    console.log('🔄 添加新字段默认值...');
    const newFields = {
      onlineStatus: null,
      onlineStatusUpdatedAt: null,
      heartbeatCount: 0,
      trafficStats: [],
      signalStrength: null,
      cellId: null,
      networkType: null,
    };

    await db
      .collection(collectionName)
      .updateMany({}, { $setOnInsert: newFields }, { upsert: false });

    // 4. 创建或更新索引
    console.log('🔄 创建/更新索引...');

    // 删除旧的索引（如果存在）
    const oldIndexes = [
      'connectionStatus_1_lastSeen_-1',
      'ipAddress_1',
      'lastHeartbeat_1',
      'manufacturer_1_model_1',
    ];

    for (const indexName of oldIndexes) {
      try {
        await db.collection(collectionName).dropIndex(indexName);
        console.log(`🗑️  删除旧索引: ${indexName}`);
      } catch (error) {
        // 索引可能不存在，忽略错误
      }
    }

    // 创建新索引
    const indexes = [
      // 唯一索引
      { key: { cpeId: 1 }, options: { unique: true, name: 'cpeId_1' } },
      { key: { deviceId: 1 }, options: { name: 'deviceId_1' } },

      // 复合索引
      {
        key: { connectionStatus: 1, lastSeen: -1 },
        options: { name: 'connectionStatus_1_lastSeen_-1' },
      },
      {
        key: { manufacturer: 1, model: 1 },
        options: { name: 'manufacturer_1_model_1' },
      },

      // 单字段索引
      { key: { ipAddress: 1 }, options: { name: 'ipAddress_1' } },
      { key: { lastHeartbeat: 1 }, options: { name: 'lastHeartbeat_1' } },
      { key: { lastSeen: -1 }, options: { name: 'lastSeen_-1' } },

      // 新增字段索引
      { key: { onlineStatus: 1 }, options: { name: 'onlineStatus_1' } },
      {
        key: { onlineStatusUpdatedAt: 1 },
        options: { name: 'onlineStatusUpdatedAt_1' },
      },
      {
        key: { 'trafficStats.timestamp': -1 },
        options: { name: 'trafficStats.timestamp_-1' },
      },
      { key: { cellId: 1 }, options: { name: 'cellId_1' } },
    ];

    for (const index of indexes) {
      try {
        await db
          .collection(collectionName)
          .createIndex(index.key, index.options);
        console.log(`✅ 创建索引: ${index.options.name}`);
      } catch (error) {
        console.log(
          `⚠️  索引 ${index.options.name} 可能已存在:`,
          error.message,
        );
      }
    }

    console.log('🎉 CPE集合结构更新完成！');
    console.log('📊 统计信息:');
    const count = await db.collection(collectionName).countDocuments();
    console.log(`   文档总数: ${count}`);
  },

  async down(db) {
    const collectionName = 'cpes';

    console.log('🔄 开始回滚CPE集合结构...');

    // 1. 将bootCount重命名回rebootCount
    console.log('🔄 重命名字段: bootCount -> rebootCount...');
    try {
      await db
        .collection(collectionName)
        .updateMany(
          { bootCount: { $exists: true } },
          { $rename: { bootCount: 'rebootCount' } },
        );
      console.log('✅ 字段重命名回滚完成');
    } catch (error) {
      console.log('⚠️  回滚字段重命名失败:', error.message);
    }

    // 2. 删除新增字段
    console.log('🔄 删除新增字段...');
    const fieldsToUnset = {
      onlineStatus: '',
      onlineStatusUpdatedAt: '',
      heartbeatCount: '',
      trafficStats: '',
      signalStrength: '',
      cellId: '',
      networkType: '',
    };

    try {
      await db
        .collection(collectionName)
        .updateMany({}, { $unset: fieldsToUnset });
      console.log('✅ 新增字段删除完成');
    } catch (error) {
      console.log('⚠️  删除字段失败:', error.message);
    }

    // 3. 删除新增的索引
    console.log('🔄 删除新增索引...');
    const newIndexes = [
      'onlineStatus_1',
      'onlineStatusUpdatedAt_1',
      'trafficStats.timestamp_-1',
      'cellId_1',
    ];

    for (const indexName of newIndexes) {
      try {
        await db.collection(collectionName).dropIndex(indexName);
        console.log(`🗑️  删除索引: ${indexName}`);
      } catch (error) {
        console.log(`⚠️  索引 ${indexName} 可能不存在:`, error.message);
      }
    }

    console.log('✅ CPE集合结构回滚完成！');
  },
};
