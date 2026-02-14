import mongoose from 'mongoose';
import config from '../config';

class Database {
  private static instance: Database;

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      await mongoose.connect(config.mongodb.uri, config.mongodb.options);
      // eslint-disable-next-line no-console
      console.log('✅ MongoDB连接成功');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ MongoDB连接失败:', error);
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
    // eslint-disable-next-line no-console
    console.log('✅ MongoDB连接已断开');
  }

  getConnection(): mongoose.Connection {
    return mongoose.connection;
  }
}

export default Database.getInstance();
