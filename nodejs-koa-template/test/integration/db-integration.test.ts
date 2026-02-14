// test/integration/db-integration.test.ts
import request from 'supertest';
import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  expect,
} from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// 注意：不要在这里导入 App，我们会在设置环境变量后动态导入

describe('Database Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let deviceId: string;
  let appInstance: any;
  let getTestApp: () => any;

  beforeAll(async () => {
    // 1. 启动内存MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // 2. 关键：在导入任何模块之前设置环境变量
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongoUri;
    process.env.LOG_LEVEL = 'error';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.RATE_LIMIT_ENABLED = 'false';
    process.env.HELMET_ENABLED = 'false';
    process.env.COMPRESSION_ENABLED = 'false';
    process.env.PERFORMANCE_MONITORING_ENABLED = 'false';

    // 3. 手动连接数据库
    await mongoose.connect(mongoUri);

    // 4. 动态导入 App 类
    const AppModule = await import('../../src/app');
    const App = AppModule.default;
    appInstance = new App();

    getTestApp = () => appInstance.getApp().callback();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    deviceId = `test-device-${Date.now()}`;
  });

  describe('Device CRUD Operations', () => {
    it('should create a new device', async () => {
      const response = await request(getTestApp())
        .post('/api/devices')
        .send({
          deviceId,
          manufacturer: 'Test Manufacturer',
          model: 'Test Model',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
          status: 'online',
          parameters: {},
          tags: [],
          metadata: {},
        })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.deviceId).toBe(deviceId);
      expect(response.body.data.status).toBe('online');
    });

    it('should retrieve all devices', async () => {
      // 先创建两个设备
      await request(getTestApp())
        .post('/api/devices')
        .send({
          deviceId: `${deviceId}-1`,
          manufacturer: 'Manufacturer 1',
          model: 'Model A',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.101',
          status: 'online',
          parameters: {},
          tags: [],
          metadata: {},
        });

      await request(getTestApp())
        .post('/api/devices')
        .send({
          deviceId: `${deviceId}-2`,
          manufacturer: 'Manufacturer 2',
          model: 'Model B',
          firmwareVersion: '1.0.1',
          ipAddress: '192.168.1.102',
          status: 'offline',
          parameters: {},
          tags: [],
          metadata: {},
        });

      const response = await request(getTestApp())
        .get('/api/devices')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should retrieve device by ID', async () => {
      // 创建设备
      await request(getTestApp()).post('/api/devices').send({
        deviceId,
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        firmwareVersion: '1.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
        parameters: {},
        tags: [],
        metadata: {},
      });

      const response = await request(getTestApp())
        .get(`/api/devices/${deviceId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deviceId).toBe(deviceId);
    });

    it('should update device', async () => {
      // 创建设备
      await request(getTestApp()).post('/api/devices').send({
        deviceId,
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        firmwareVersion: '1.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
        parameters: {},
        tags: [],
        metadata: {},
      });

      const response = await request(getTestApp())
        .put(`/api/devices/${deviceId}`)
        .send({
          status: 'offline',
          firmwareVersion: '1.0.1',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('offline');
      expect(response.body.data.firmwareVersion).toBe('1.0.1');
    });

    it('should delete device', async () => {
      // 创建设备
      await request(getTestApp()).post('/api/devices').send({
        deviceId,
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        firmwareVersion: '1.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
        parameters: {},
        tags: [],
        metadata: {},
      });

      await request(getTestApp())
        .delete(`/api/devices/${deviceId}`)
        .expect(200);

      // 验证设备已被删除
      const response = await request(getTestApp())
        .get(`/api/devices/${deviceId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('设备不存在');
    });
  });
});
