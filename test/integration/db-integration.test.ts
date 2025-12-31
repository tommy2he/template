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
import app from '../../src/app';

describe('Database Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let deviceId: string;

  beforeAll(async () => {
    // 使用内存MongoDB进行测试
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // 替换应用数据库连接为测试数据库
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DB_NAME = 'koa_template_test';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清空测试数据库
    await mongoose.connection.dropDatabase();
    deviceId = `test-device-${Date.now()}`;
  });

  describe('Device CRUD Operations', () => {
    it('should create a new device', async () => {
      const response = await request(app.callback())
        .post('/api/devices')
        .send({
          deviceId,
          serialNumber: 'TEST-SN-001',
          manufacturer: 'Test Manufacturer',
          model: 'Test Model',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
          status: 'online',
        })
        .expect(201);

      expect(response.body.deviceId).toBe(deviceId);
      expect(response.body.status).toBe('online');
    });

    it('should retrieve all devices', async () => {
      // 先创建两个设备
      await request(app.callback())
        .post('/api/devices')
        .send({
          deviceId: `${deviceId}-1`,
          serialNumber: 'TEST-SN-001',
          manufacturer: 'Manufacturer 1',
          model: 'Model A',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.101',
          status: 'online',
        });

      await request(app.callback())
        .post('/api/devices')
        .send({
          deviceId: `${deviceId}-2`,
          serialNumber: 'TEST-SN-002',
          manufacturer: 'Manufacturer 2',
          model: 'Model B',
          firmwareVersion: '1.0.1',
          ipAddress: '192.168.1.102',
          status: 'offline',
        });

      const response = await request(app.callback())
        .get('/api/devices')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should retrieve device by ID', async () => {
      // 创建设备
      await request(app.callback()).post('/api/devices').send({
        deviceId,
        serialNumber: 'TEST-SN-001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        firmwareVersion: '1.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
      });

      const response = await request(app.callback())
        .get(`/api/devices/${deviceId}`)
        .expect(200);

      expect(response.body.deviceId).toBe(deviceId);
      expect(response.body.serialNumber).toBe('TEST-SN-001');
    });

    it('should update device', async () => {
      // 创建设备
      await request(app.callback()).post('/api/devices').send({
        deviceId,
        serialNumber: 'TEST-SN-001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        firmwareVersion: '1.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
      });

      const response = await request(app.callback())
        .put(`/api/devices/${deviceId}`)
        .send({
          status: 'offline',
          firmwareVersion: '1.0.1',
        })
        .expect(200);

      expect(response.body.status).toBe('offline');
      expect(response.body.firmwareVersion).toBe('1.0.1');
    });

    it('should delete device', async () => {
      // 创建设备
      await request(app.callback()).post('/api/devices').send({
        deviceId,
        serialNumber: 'TEST-SN-001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        firmwareVersion: '1.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
      });

      await request(app.callback())
        .delete(`/api/devices/${deviceId}`)
        .expect(200);

      // 验证设备已被删除
      await request(app.callback()).get(`/api/devices/${deviceId}`).expect(404);
    });

    it('should filter devices by status', async () => {
      // 创建不同状态的设备
      await request(app.callback())
        .post('/api/devices')
        .send({
          deviceId: `${deviceId}-1`,
          serialNumber: 'TEST-SN-001',
          manufacturer: 'Manufacturer 1',
          model: 'Model A',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.101',
          status: 'online',
        });

      await request(app.callback())
        .post('/api/devices')
        .send({
          deviceId: `${deviceId}-2`,
          serialNumber: 'TEST-SN-002',
          manufacturer: 'Manufacturer 2',
          model: 'Model B',
          firmwareVersion: '1.0.1',
          ipAddress: '192.168.1.102',
          status: 'offline',
        });

      const response = await request(app.callback())
        .get('/api/devices?status=online')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('online');
    });
  });

  describe('Database Connection', () => {
    it('should handle database connection errors gracefully', async () => {
      // 断开数据库连接
      await mongoose.disconnect();

      const response = await request(app.callback())
        .get('/api/devices')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
