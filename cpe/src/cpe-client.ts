import axios from 'axios';
import WebSocket from 'ws';
import EventEmitter from 'events';

interface CPEClientConfig {
  deviceId: string;
  cpeId: string;
  manufacturer: string;
  model: string;
  serverUrl: string;
  wsUrl: string;
  heartbeatInterval: number;
  capabilities: string[];
  simulateMetrics: boolean;
  metricsInterval: number;
}

interface RegistrationResponse {
  success: boolean;
  cpeId: string;
  token: string;
  wsConnectionUrl: string;
  heartbeatInterval: number;
}

export class CPEClient extends EventEmitter {
  private config: CPEClientConfig;
  private token: string | null = null;
  private wsConnectionUrl: string | null = null;
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private currentConfiguration: Record<string, any> = {};
  private pendingConfiguration: Record<string, any> | null = null;

  constructor(config: CPEClientConfig) {
    super();
    this.config = config;
  }

  // 注册到主应用
  async register(): Promise<RegistrationResponse> {
    console.log('📝 正在注册到主应用...');

    try {
      const response = await axios.post(
        `${this.config.serverUrl}/api/cpes/register`,
        {
          deviceId: this.config.deviceId,
          cpeId: this.config.cpeId,
          capabilities: this.config.capabilities,
          metadata: {
            manufacturer: this.config.manufacturer,
            model: this.config.model,
            firmwareVersion: '1.0.0',
            ipAddress: this.getLocalIP(),
            macAddress: this.generateMacAddress(),
          },
        },
      );

      if (response.data.success) {
        this.token = response.data.token;
        this.wsConnectionUrl = response.data.wsConnectionUrl;

        console.log('✅ 注册成功');
        console.log(`🔐 Token: ${this.token?.substring(0, 20)}...`);
        console.log(`📡 WebSocket URL: ${this.wsConnectionUrl}`);

        return response.data;
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      console.error('❌ 注册失败:', error.message);
      if (error.response) {
        console.error('响应数据:', error.response.data);
      }
      throw error;
    }
  }

  // 连接WebSocket
  async connectWebSocket(): Promise<void> {
    if (!this.token || !this.wsConnectionUrl) {
      throw new Error('Not registered or missing token');
    }

    return new Promise((resolve, reject) => {
      console.log('🔗 正在连接WebSocket...');

      this.ws = new WebSocket(this.wsConnectionUrl!);

      this.ws.on('open', () => {
        console.log('✅ WebSocket连接已建立');
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket连接关闭: ${code} - ${reason}`);
        this.isConnected = false;
        this.emit('disconnected', { code, reason });

        // 尝试重连
        setTimeout(() => {
          if (!this.isConnected) {
            console.log('🔄 尝试重新连接...');
            this.connectWebSocket().catch(console.error);
          }
        }, 5000);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket错误:', error.message);
        this.isConnected = false;
        reject(error);
      });
    });
  }

  // 启动心跳
  startHeartbeat(): void {
    console.log(`💓 启动心跳，间隔: ${this.config.heartbeatInterval}秒`);

    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.config.heartbeatInterval * 1000);

    // 立即发送第一次心跳
    setTimeout(() => this.sendHeartbeat(), 1000);
  }

  // 发送心跳
  private async sendHeartbeat(): Promise<void> {
    if (!this.token) return;

    try {
      const response = await axios.post(
        `${this.config.serverUrl}/api/cpes/${this.config.cpeId}/heartbeat`,
        {
          status: this.isConnected ? 'connected' : 'offline',
          metrics: this.simulateMetrics ? this.generateMetrics() : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        },
      );

      if (response.data.hasPendingConfiguration) {
        console.log('📥 有待处理的配置更新');
        await this.fetchPendingConfiguration();
      }

      this.emit('heartbeat', response.data);
    } catch (error: any) {
      console.error('❌ 心跳发送失败:', error.message);

      // 如果心跳失败，可能是token过期，尝试重新注册
      if (error.response?.status === 401) {
        console.log('🔐 Token可能过期，尝试重新注册...');
        await this.register();
      }
    }
  }

  // 启动指标模拟
  startMetricsSimulation(): void {
    console.log('📊 启动指标模拟');

    this.metricsTimer = setInterval(() => {
      this.reportStatus();
    }, this.config.metricsInterval * 1000);

    // 立即上报一次状态
    setTimeout(() => this.reportStatus(), 2000);
  }

  // 上报状态
  private async reportStatus(): Promise<void> {
    if (!this.isConnected || !this.ws) return;

    const metrics = this.generateMetrics();

    this.ws.send(
      JSON.stringify({
        type: 'status',
        metrics,
        timestamp: new Date().toISOString(),
        configuration: this.currentConfiguration,
      }),
    );

    this.emit('status', metrics);
  }

  // 处理WebSocket消息
  private handleWebSocketMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'welcome':
          console.log('👋 收到欢迎消息:', data.message);
          break;

        case 'heartbeat_ack':
          // console.log('💓 心跳确认');
          break;

        case 'configuration_update':
          console.log('⚙️ 收到配置更新:', data.configuration);
          this.handleConfigurationUpdate(data.configuration);
          break;

        case 'disconnect':
          console.log('🔌 收到断开连接请求:', data.reason);
          this.shutdown();
          break;

        default:
          console.log('📨 收到未知消息类型:', data.type);
      }

      this.emit('message', data);
    } catch (error) {
      console.error('❌ 消息解析失败:', error);
    }
  }

  // 处理配置更新
  private async handleConfigurationUpdate(
    configuration: Record<string, any>,
  ): Promise<void> {
    this.pendingConfiguration = configuration;

    // 模拟应用配置的过程
    console.log('🔧 正在应用配置...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 更新当前配置
    this.currentConfiguration = {
      ...this.currentConfiguration,
      ...configuration,
    };

    // 发送确认
    if (this.ws && this.isConnected) {
      this.ws.send(
        JSON.stringify({
          type: 'configuration_ack',
          configuration: this.currentConfiguration,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    console.log('✅ 配置已应用');
    this.pendingConfiguration = null;

    this.emit('configurationUpdated', this.currentConfiguration);
  }

  // 获取待处理的配置
  private async fetchPendingConfiguration(): Promise<void> {
    try {
      const response = await axios.get(
        `${this.config.serverUrl}/api/cpes/${this.config.cpeId}`,
      );

      if (response.data.pendingConfiguration) {
        console.log('📥 获取到待处理配置');
        await this.handleConfigurationUpdate(
          response.data.pendingConfiguration,
        );
      }
    } catch (error) {
      console.error('❌ 获取配置失败:', error);
    }
  }

  // 生成模拟指标
  private generateMetrics(): Record<string, any> {
    return {
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

  // 获取本地IP（模拟）
  private getLocalIP(): string {
    return `192.168.1.${Math.floor(Math.random() * 100) + 100}`;
  }

  // 生成MAC地址（模拟）
  private generateMacAddress(): string {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      mac += hex[Math.floor(Math.random() * 16)];
      mac += hex[Math.floor(Math.random() * 16)];
      if (i < 5) mac += ':';
    }
    return mac;
  }

  // 关闭客户端
  async shutdown(): Promise<void> {
    console.log('🛑 正在关闭CPE客户端...');

    // 清理定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // 关闭WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;

    console.log('✅ CPE客户端已关闭');
  }

  // 获取当前状态
  getStatus() {
    return {
      isConnected: this.isConnected,
      cpeId: this.config.cpeId,
      currentConfiguration: this.currentConfiguration,
      pendingConfiguration: this.pendingConfiguration,
      lastHeartbeat: new Date().toISOString(),
    };
  }
}
