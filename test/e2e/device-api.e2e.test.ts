import axios from 'axios';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

describe('真正的设备API E2E测试', () => {
  const BASE_URL = 'http://localhost:3000';
  const API_URL = `${BASE_URL}/api/devices`;
  const TEST_DEVICE_ID = 'dev-real-e2e-001';

  beforeAll(async () => {
    console.log('🌐 连接到运行中的应用:', BASE_URL);

    try {
      const healthResponse = await axios.get(`${BASE_URL}/api/health`);
      console.log('✅ 应用正在运行，状态:', healthResponse.status);
    } catch (error) {
      console.error('❌ 应用未运行，请先启动应用: npm run dev');
      throw error;
    }

    // 清理测试数据
    try {
      const deleteResponse = await axios.delete(`${API_URL}/${TEST_DEVICE_ID}`);
      console.log(
        `✅ 清理了测试设备: ${TEST_DEVICE_ID}，状态: ${deleteResponse.status}`,
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`ℹ️  设备不存在，无需清理: ${TEST_DEVICE_ID}`);
      } else {
        console.log(`⚠️  清理设备时出现错误:`, error.message);
      }
    }
  });

  it('应该通过真实网络创建设备', async () => {
    try {
      const response = await axios.post(API_URL, {
        deviceId: TEST_DEVICE_ID,
        serialNumber: 'SN-REAL-E2E-001',
        manufacturer: 'TP-Link',
        model: 'Archer C7',
        firmwareVersion: '2.0.0',
        ipAddress: '192.168.1.100',
        status: 'online',
      });

      console.log('状态码:', response.status);
      console.log('返回数据:', JSON.stringify(response.data, null, 2));

      // 修改为 201，这是创建资源的标准响应
      expect(response.status).toBe(201);
      expect(response.data.data.deviceId).toBe(TEST_DEVICE_ID);
      console.log('✅ 设备创建成功');
    } catch (error: any) {
      if (error.response) {
        console.error('❌ 服务器响应错误:');
        console.error('状态码:', error.response.status);
        console.error(
          '响应数据:',
          JSON.stringify(error.response.data, null, 2),
        );
      } else if (error.request) {
        console.error('❌ 无响应:', error.request);
      } else {
        console.error('❌ 请求错误:', error.message);
      }
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await axios.delete(`${API_URL}/${TEST_DEVICE_ID}`);
      console.log(`✅ 测试完成后清理了设备: ${TEST_DEVICE_ID}`);
    } catch (error: any) {
      console.log(`⚠️  测试后清理设备失败:`, error.message);
    }
  });
});
