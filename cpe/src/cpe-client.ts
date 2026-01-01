// /cpe/src/cpe-client.ts - 支持UDP唤醒的完整CPE客户端
/* eslint-disable no-console */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { UDPClient } from './udp-client';

export interface CPEClientConfig {
  cpeId: string;
  deviceId: string;
  manufacturer: string;
  model: string;
  acsUrl: string;
  acsIp: string;
  acsUdpPort: number;
  heartbeatInterval: number;
  capabilities: string[];
  simulateMetrics: boolean;
}

export class CPEClient extends EventEmitter {
  private config: CPEClientConfig;
  private ws: WebSocket | null = null;
  private udpClient: UDPClient;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private isRegistered = false;

  constructor(config: CPEClientConfig) {
    super();
    this.config = config;
    this.udpClient = new UDPClient(config.acsIp, config.acsUdpPort);
    this.setupUDPListeners();
  }

  private setupUDPListeners() {
    // 监听UDP唤醒消息
    this.udpClient.on('wakeup', (data: any) => {
      console.log('🔔 收到ACS唤醒指令，建立WebSocket连接...');
      this.connectToACS();
    });

    // 监听其他UDP消息
    this.udpClient.on('message', (message: any) => {
      console.log('📨 处理UDP消息:', message.type);
    });
  }

  // CPE启动入口
  public async start(): Promise<void> {
    console.log('🚀 CPE客户端启动');
    console.log('='.repeat(50));
    console.log(`📱 CPE ID: ${this.config.cpeId}`);
    console.log(`🏭 厂商: ${this.config.manufacturer}`);
    console.log(`📦 型号: ${this.config.model}`);
    console.log(`📡 ACS地址: ${this.config.acsUrl}`);
    console.log('='.repeat(50));

    // 1. 先发送UDP Inform通知ACS
    console.log('📢 发送UDP Inform消息到ACS...');
    this.udpClient.sendInform(this.config.cpeId, {
      manufacturer: this.config.manufacturer,
      model: this.config.model,
      capabilities: this.config.capabilities,
    });

    // 2. 建立WebSocket连接
    await this.connectToACS();

    // 3. 通过WebSocket发送Inform消息
    await this.sendInform();

    // 4. 启动心跳
    this.startHeartbeat();

    console.log('✅ CPE客户端启动完成');
  }

  // 建立WebSocket连接
  private async connectToACS(): Promise<void> {
    if (this.ws && this.isConnected) {
      console.log('🔗 WebSocket已连接，跳过重复连接');
      return;
    }

    console.log(`🔗 正在连接ACS: ${this.config.acsUrl}...`);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.acsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket连接已建立');
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket连接关闭: ${code} - ${reason}`);
        this.isConnected = false;
        this.isRegistered = false;
        this.emit('disconnected', { code, reason });

        // 尝试重连
        setTimeout(() => {
          if (!this.isConnected) {
            console.log('🔄 尝试重新连接...');
            this.connectToACS().catch(console.error);
          }
        }, 5000);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket连接错误:', error);
        reject(error);
      });
    });
  }

  // 发送TR-069 Inform消息
  private async sendInform(): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket未连接');
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = sessionId;

    const informMessage = {
      type: 'inform',
      sessionId,
      cpeId: this.config.cpeId,
      timestamp: Date.now(),
      data: {
        deviceInfo: {
          manufacturer: this.config.manufacturer,
          model: this.config.model,
          serialNumber: this.config.cpeId,
          softwareVersion: '1.0.0',
          hardwareVersion: '1.0',
          oui: this.config.manufacturer.substring(0, 6).toUpperCase(),
          productClass: this.config.model,
        },
        event: '1 BOOT', // BOOT事件
        parameterList: [
          'InternetGatewayDevice.DeviceSummary',
          'InternetGatewayDevice.DeviceInfo',
          'InternetGatewayDevice.ManagementServer',
        ],
      },
    };

    this.ws.send(JSON.stringify(informMessage));
    console.log('📨 已发送Inform消息');
  }

  // 处理WebSocket消息
  private handleWebSocketMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      console.log(`📨 收到WebSocket消息: ${data.type}`);

      switch (data.type) {
        case 'connection_ack':
          console.log('👋 收到连接确认');
          break;

        case 'informResponse':
          console.log('✅ Inform消息已确认');
          this.isRegistered = true;
          this.emit('registered', data);
          break;

        case 'heartbeatResponse':
          // console.log('💓 心跳确认');
          break;

        case 'setParameterValues':
          console.log('⚙️ 收到参数设置请求:', data.data);
          this.handleSetParameterValues(data);
          break;

        case 'getParameterValues':
          console.log('📊 收到参数获取请求');
          this.handleGetParameterValues(data);
          break;

        case 'download':
          console.log('📥 收到下载请求:', data.data?.fileUrl);
          this.handleDownload(data);
          break;

        default:
          console.warn(`📨 未知消息类型: ${data.type}`);
      }

      this.emit('message', data);
    } catch (error) {
      console.error('❌ 消息解析失败:', error);
    }
  }

  // 启动心跳
  private startHeartbeat(): void {
    console.log(`💓 启动心跳，间隔: ${this.config.heartbeatInterval}秒`);

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval * 1000);

    // 立即发送第一次心跳
    setTimeout(() => this.sendHeartbeat(), 1000);
  }

  private sendHeartbeat(): void {
    if (!this.ws || !this.isConnected) {
      return;
    }

    // 同时发送UDP和WebSocket心跳
    this.udpClient.sendHeartbeat(this.config.cpeId);

    const heartbeatMessage = {
      type: 'heartbeat',
      cpeId: this.config.cpeId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      data: {
        status: 'alive',
        uptime: process.uptime(),
      },
    };

    this.ws.send(JSON.stringify(heartbeatMessage));
  }

  // 处理参数设置
  private handleSetParameterValues(data: any): void {
    const parameters = data.data?.parameters || {};

    // 模拟应用参数
    console.log('🔧 应用参数:', parameters);

    // 发送响应
    if (this.ws && this.isConnected) {
      const response = {
        type: 'setParameterValuesResponse',
        sessionId: data.sessionId,
        status: 0, // 成功
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(response));
    }
  }

  // 处理参数获取
  private handleGetParameterValues(data: any): void {
    // 模拟返回参数值
    const parameters = {
      'InternetGatewayDevice.DeviceInfo.Manufacturer': this.config.manufacturer,
      'InternetGatewayDevice.DeviceInfo.ModelName': this.config.model,
      'InternetGatewayDevice.DeviceInfo.SoftwareVersion': '1.0.0',
      'InternetGatewayDevice.ManagementServer.ConnectionRequestURL': `http://${this.config.cpeId}:7547`,
    };

    if (this.ws && this.isConnected) {
      const response = {
        type: 'getParameterValuesResponse',
        sessionId: data.sessionId,
        parameters,
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(response));
    }
  }

  // 处理下载请求
  private handleDownload(data: any): void {
    // 模拟下载过程
    console.log('⏬ 开始下载:', data.data?.fileUrl);

    // 发送下载进度
    setTimeout(() => {
      if (this.ws && this.isConnected) {
        const response = {
          type: 'downloadResponse',
          sessionId: data.sessionId,
          status: 0,
          timestamp: Date.now(),
        };
        this.ws.send(JSON.stringify(response));
      }
    }, 2000);
  }

  // 关闭客户端
  public async shutdown(): Promise<void> {
    console.log('🛑 正在关闭CPE客户端...');

    // 清理定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 关闭WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 关闭UDP客户端
    this.udpClient.close();

    this.isConnected = false;
    this.isRegistered = false;

    console.log('✅ CPE客户端已关闭');
  }

  // 获取当前状态
  public getStatus() {
    return {
      cpeId: this.config.cpeId,
      isConnected: this.isConnected,
      isRegistered: this.isRegistered,
      sessionId: this.sessionId,
      lastHeartbeat: new Date().toISOString(),
    };
  }
}
