// 创建设备集合的迁移脚本
module.exports = {
  async up(db) {
    // 创建设备集合
    await db.createCollection('devices');

    // 创建设备索引
    await db
      .collection('devices')
      .createIndex({ deviceId: 1 }, { unique: true });
    await db.collection('devices').createIndex({ status: 1 });
    await db.collection('devices').createIndex({ lastSeen: -1 });
    await db.collection('devices').createIndex({ tags: 1 });

    console.log('✅ 设备集合和索引创建完成');
  },

  async down(db) {
    // 回滚：删除设备集合
    await db.collection('devices').drop();
    console.log('🗑️  设备集合已删除');
  },
};
