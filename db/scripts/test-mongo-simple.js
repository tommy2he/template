/* eslint-disable no-console */

// 简单的MongoDB连接测试
import { MongoClient } from 'mongodb';

async function testConnection() {
  // 使用默认连接字符串
  const uri =
    'mongodb://koa_user:koa_password@localhost:27018/koa_template_dev';

  const client = new MongoClient(uri);

  try {
    await client.connect();

    // 测试数据库操作
    const db = client.db('koa_template_dev');
    const collections = await db.listCollections().toArray();

    // 尝试创建一个测试集合
    const testCollection = db.collection('test_connection');
    await testCollection.insertOne({
      message: '测试连接',
      timestamp: new Date(),
    });

    // 读取数据
    const result = await testCollection.findOne({});

    // 清理测试数据
    await testCollection.deleteMany({});

    return {
      success: true,
      collectionsCount: collections.length,
      testData: result,
      message: 'MongoDB连接测试成功',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error,
    };
  } finally {
    await client.close();
  }
}

// 运行测试并输出结果
testConnection().then((result) => {
  // 在测试脚本中，我们仍然需要显示结果
  // 如果这是生产代码，应该使用logger而不是console
  if (result.success) {
    console.log('✅ MongoDB连接测试成功');
    console.log(`📊 数据库中有 ${result.collectionsCount} 个集合`);
    console.log('📄 读取的数据:', result.testData);
  } else {
    console.error('❌ 连接失败:', result.error);
    console.error('错误详情:', result.details);
  }
});
