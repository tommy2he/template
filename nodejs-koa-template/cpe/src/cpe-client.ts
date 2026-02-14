// /cpe/src/cpe-client.ts - 支持UDP唤醒的完整CPE客户端
/* eslint-disable no-console */
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { UDPServer } from './udp-server'; // 改为UDP服务器

export interface CPEClientConfig {
  // CPE标识信息
  cpeId: string;
  deviceId: string;
  manufacturer: string;
  model: string;

  // ACS服务器配置（CPE需要连接的服务器）
  acsUrl: string; // WebSocket地址，如 ws://localhost:7547
  acsHost: string; // ACS主机地址，如 localhost（用于UDP唤醒包的源地址）

  // CPE本地配置
  cpeUdpPort: number; // CPE的UDP服务器监听端口，如 7548
  cpeIp: string; // CPE的IP地址（用于接收UDP唤醒包）

  // 心跳配置
  heartbeatInterval: number;

  // 设备能力
  capabilities: string[];

  // 模拟配置
  simulateMetrics: boolean;

  // 可选的高级配置
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  udpTimeout?: number;

  // 新增：连接空闲超时配置（毫秒）
  inactivityTimeout?: number;
}

export class CPEClient extends EventEmitter {
  private config: CPEClientConfig;
  private ws: WebSocket | null = null;
  private udpServer: UDPServer;
  private heartbeatTimer: NodeJS.Timeout | null = null; // 心跳定时器（独立运行）
  private inactivityTimer: NodeJS.Timeout | null = null; // 连接空闲检查定时器
  private sessionId: string | null = null;
  private isConnected = false;
  private isRegistered = false;
  private lastHeartbeatTime: number = 0; // 上次心跳时间
  private serverActivityMarker: 'x' | 'y' = 'x'; // 服务器活动标记
  private hasSentBootInform: boolean = false; // 是否已发送Inform消息

  constructor(config: CPEClientConfig) {
    super();
    this.config = {
      inactivityTimeout: 30000, // 默认30秒
      ...config,
    };

    // 创建UDP服务器
    this.udpServer = new UDPServer(this.config.cpeUdpPort || 7548);
    this.setupUDPListeners();
  }

  private setupUDPListeners() {
    // 监听UDP服务器启动事件
    this.udpServer.on('listening', () => {
      console.log(`✅ UDP服务器已启动，等待ACS唤醒...`);
    });

    // 监听UDP消息事件
    this.udpServer.on('message', (message: any, rinfo) => {
      // 这里处理所有UDP消息
      // 注意：UDPServer内部已经解析了消息，所以message已经是对象
      console.log(
        `📡 收到UDP消息 from ${rinfo.address}:${rinfo.port}:`,
        message.type,
      );

      // 可以根据消息类型进一步处理
      if (message.type === 'wakeup') {
        this.emit('wakeup', message, rinfo);
      }
    });

    // 监听UDP唤醒消息
    this.udpServer.on('wakeup', (message: any) => {
      console.log('🔔 收到ACS唤醒指令，建立WebSocket连接...');
      console.log(`   ACS地址: ${message.acsUrl}`);

      // 如果需要，更新ACS地址
      if (message.acsUrl && message.acsUrl !== this.config.acsUrl) {
        console.log(
          `   ️更新ACS地址: ${this.config.acsUrl} -> ${message.acsUrl}`,
        );
        this.config.acsUrl = message.acsUrl;
      }

      // 建立WebSocket连接
      this.connectToACS().catch(console.error);
    });

    // 监听错误事件
    this.udpServer.on('error', (error) => {
      console.error('❌ UDP服务器错误:', error);
    });

    // 监听关闭事件
    this.udpServer.on('closed', () => {
      console.log('🔒 UDP服务器已关闭');
    });
  }

  // CPE启动入口
  public async start(): Promise<void> {
    console.log('🚀 CPE客户端启动');
    console.log('='.repeat(50));

    try {
      // 1. 启动UDP服务器
      console.log('🚀 启动UDP服务器...');
      await this.udpServer.start();

      // 2. 启动心跳定时器（独立运行，不管连接状态）
      this.startHeartbeatTimer();

      console.log('✅ CPE客户端启动完成');
    } catch (error) {
      console.error('❌ CPE客户端启动失败:', error);
      throw error;
    }
  }

  // 启动心跳定时器（独立运行）
  private startHeartbeatTimer(): void {
    console.log(`⏰ 启动心跳定时器，间隔: ${this.config.heartbeatInterval}秒`);

    // 清除现有定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval * 1000);

    // 立即发送第一次心跳
    setTimeout(() => this.sendHeartbeat(), 1000);
  }

  // 建立WebSocket连接
  private async connectToACS(): Promise<void> {
    if (this.ws && this.isConnected) {
      console.log('🔗 WebSocket已连接，跳过重复连接');
      return;
    }

    console.log(`🔗 正在连接ACS: ${this.config.acsUrl}...`);

    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.acsUrl}?cpeId=${encodeURIComponent(this.config.cpeId)}`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error: any) {
        // WebSocket构造函数可能同步抛出错误
        console.error('❌ 创建WebSocket连接失败');
        console.error(`   错误: ${error.message}`);
        console.error('   请检查ACS服务器地址格式');
        reject(error);
        return;
      }

      this.ws.on('open', () => {
        console.log('✅ WebSocket连接已建立');
        this.isConnected = true;
        this.startInactivityCheck();

        if (!this.hasSentBootInform) {
          console.log('📨 发送Inform消息（首次连接）');
          this.sendInform();
        } else {
          console.log('💓 发送Heartbeat消息（心跳连接）');
          this.sendHeartbeatMessage();
        }

        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket连接关闭: ${code} - ${reason}`);
        this.isConnected = false;
        this.stopInactivityCheck();
        this.emit('disconnected', { code, reason });
      });

      this.ws.on('error', (error: Error & { code?: string }) => {
        // 友好的错误提示
        this.handleConnectionError(error);
        this.isConnected = false;
        this.ws = null;
        reject(new Error(`连接失败: ${error.message}`));
      });
    });
  }

  // 专用的连接错误处理方法
  private handleConnectionError(error: Error & { code?: string }): void {
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || '未知错误';

    console.error('❌ 连接ACS服务器失败');
    console.error(`   错误代码: ${errorCode}`);
    console.error(`   服务器地址: ${this.config.acsUrl}`);

    // 根据常见错误代码提供友好提示
    switch (errorCode) {
      case 'ECONNREFUSED':
        console.error('   提示：ACS服务器可能未启动或端口被占用');
        console.error('   建议：请检查服务器是否已启动，或等待服务器启动');
        break;
      case 'ENOTFOUND':
        console.error(
          `   提示：无法解析主机名 "${new URL(this.config.acsUrl).hostname}"`,
        );
        console.error('   建议：请检查ACS服务器地址是否正确');
        break;
      case 'ETIMEDOUT':
        console.error('   提示：连接超时');
        console.error('   建议：请检查网络连接或调整连接超时时间');
        break;
      case 'EADDRNOTAVAIL':
        console.error('   提示：本地地址不可用');
        console.error('   建议：请检查本地网络配置');
        break;
      default:
        // 对于其他错误，显示原始消息（但截断过长的堆栈）
        const shortMessage = errorMessage.split('\n')[0].substring(0, 200);
        console.error(
          `   错误详情: ${shortMessage}${errorMessage.length > 200 ? '...' : ''}`,
        );
    }

    console.error('   CPE将继续运行，等待下一次心跳尝试...');
    console.error('   当前时间:', new Date().toISOString());
  }

  // 启动空闲连接检查
  private startInactivityCheck(): void {
    if (!this.config.inactivityTimeout || this.config.inactivityTimeout <= 0) {
      console.log('⏰ 空闲连接检查已禁用');
      return;
    }

    console.log(
      `⏰ 启动空闲连接检查，超时时间: ${this.config.inactivityTimeout}ms`,
    );
    console.log(`⏱️  当前时间: ${new Date().toISOString()}`);

    // 清除现有定时器
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    // 初始化标记为x
    this.serverActivityMarker = 'x';

    // 设置30秒的单次定时器（不是每5秒检查的interval）
    this.inactivityTimer = setTimeout(() => {
      this.checkInactivity();
    }, this.config.inactivityTimeout);
  }

  // 停止空闲检查
  private stopInactivityCheck(): void {
    if (this.inactivityTimer) {
      console.log(`🛑 清除空闲检查定时器，时间: ${new Date().toISOString()}`);
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  // 检查连接是否空闲
  private checkInactivity(): void {
    if (!this.isConnected || !this.ws) {
      console.log('🔄 连接已断开，无需检查空闲');
      return;
    }

    console.log(`⏱️  检查空闲时间: ${new Date().toISOString()}`);
    console.log(`📊 当前标记: ${this.serverActivityMarker}`);

    if (this.serverActivityMarker === 'y') {
      // 近期有服务器数据，重置定时器
      console.log('🔄 近期有服务器数据，重置空闲检查');
      this.serverActivityMarker = 'x';
      this.startInactivityCheck(); // 重新开始30秒计时
    } else {
      // 标记为x，表示空闲超时
      console.log(
        `🛑 连接空闲超时，主动断开连接 (${this.config.inactivityTimeout}ms 无数据)`,
      );
      console.log(`⏱️  断开时间: ${new Date().toISOString()}`);

      // 清除定时器
      this.inactivityTimer = null;

      // 断开连接
      this.ws.close(1000, 'Inactivity timeout');
    }
  }

  // 更新服务器活动标记
  private updateServerActivity(messageType?: string): void {
    const timestamp = new Date().toISOString();
    const typeInfo = messageType ? ` (${messageType})` : '';
    console.log(`📨 收到数据${typeInfo}，设置标记为 y，时间: ${timestamp}`);
    this.serverActivityMarker = 'y';
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
        event: '1 BOOT',
        parameterList: [
          'InternetGatewayDevice.DeviceSummary',
          'InternetGatewayDevice.DeviceInfo',
          'InternetGatewayDevice.ManagementServer',
        ],
        udpPort: this.config.cpeUdpPort || 7548,
        localIp: this.config.cpeIp || '127.0.0.1',
      },
    };

    this.ws.send(JSON.stringify(informMessage));
    console.log('📨 已发送Inform消息（1 BOOT）');
  }

  // 发送Heartbeat消息（轻量级心跳）
  private sendHeartbeatMessage(): void {
    if (!this.ws || !this.isConnected) {
      console.error('❌ 发送Heartbeat失败：连接未建立');
      return;
    }

    const heartbeatMessage = {
      type: 'heartbeat',
      cpeId: this.config.cpeId,
      timestamp: Date.now(),
      data: {
        status: 'alive',
        udpPort: this.config.cpeUdpPort || 7548,
        localIp: this.config.cpeIp || '127.0.0.1',
        // 可以添加其他轻量级信息
      },
    };

    this.ws.send(JSON.stringify(heartbeatMessage));
    console.log('💓 Heartbeat已发送');
  }

  // 处理WebSocket消息
  private handleWebSocketMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      console.log(`📨 收到WebSocket消息: ${data.type}`);

      // 重要：更新服务器活动标记（唯一调用点）
      this.updateServerActivity();

      switch (data.type) {
        case 'connection_ack':
          console.log('👋 收到连接确认');
          break;
        case 'informResponse':
          console.log('✅ Inform消息已确认，标记为已发送');
          this.hasSentBootInform = true;
          this.isRegistered = true;
          this.emit('registered', data);
          break;
        case 'heartbeatResponse':
          console.log('💓 心跳确认');
          break;
        // ... 其他消息处理
      }

      this.emit('message', data);
    } catch (error) {
      console.error('❌ 消息解析失败:', error);
    }
  }

  // 发送心跳（建立TCP连接，发送心跳，然后可能断开）
  private async sendHeartbeat(): Promise<void> {
    console.log('💓 心跳时间到，准备发送心跳...');

    // 记录心跳时间
    this.lastHeartbeatTime = Date.now();

    try {
      // 如果已有连接，直接使用现有连接
      if (!this.ws || !this.isConnected) {
        console.log('🔗 建立连接以发送心跳...');
        await this.connectToACS();
      } else {
        // 已经连接，直接发送Heartbeat
        this.sendHeartbeatMessage();
      }
    } catch (error: any) {
      // 友好的错误提示，不打印详细堆栈
      console.error('❌ 发送心跳失败');
      console.error(`   原因: ${error.message || '未知错误'}`);
      console.error('   CPE将继续运行，等待下一次心跳...');

      // 计算下次心跳时间
      const nextHeartbeatTime = new Date(
        Date.now() + this.config.heartbeatInterval * 1000,
      );
      console.error(`   下次心跳时间: ${nextHeartbeatTime.toISOString()}`);
      console.error(`   大约还有 ${this.config.heartbeatInterval} 秒`);

      // 重要：这里不抛出错误，避免进程退出
      // 心跳失败不影响CPE核心运行
    }
  }

  // 生成模拟的CPE指标
  private generateMetrics(): Record<string, any> {
    return {
      system: {
        ip: this.config.cpeIp || '127.0.0.1',
        udpPort: this.config.cpeUdpPort || 7548,
      },
      cpu: {
        usage: Math.random() * 100,
        temperature: 40 + Math.random() * 20,
      },
      memory: {
        total: 1024,
        used: 512 + Math.random() * 256,
        free: 256 - Math.random() * 128,
      },
      network: {
        up: Math.random() * 1000,
        down: Math.random() * 1000,
        connections: Math.floor(Math.random() * 100),
      },
      wifi: {
        clients: Math.floor(Math.random() * 10),
        signal: -30 - Math.random() * 40,
      },
    };
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

    this.stopInactivityCheck();

    // 关闭WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 关闭UDP服务器
    await this.udpServer.stop();

    this.isConnected = false;
    this.isRegistered = false;
    // 注意：hasSentBootInform不需要重置，因为CPE重启后整个进程会重启

    console.log('✅ CPE客户端已关闭');
  }

  // 获取当前状态
  public getStatus() {
    return {
      cpeId: this.config.cpeId,
      isConnected: this.isConnected,
      isRegistered: this.isRegistered,
      hasSentBootInform: this.hasSentBootInform,
      sessionId: this.sessionId,
      lastHeartbeat: new Date().toISOString(),
    };
  }
}
