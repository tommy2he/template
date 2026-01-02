/* eslint-disable no-console */

// /src/websocket/server.ts - 增强版WebSocket服务器
import { Server as WebSocketServer, WebSocket as WS } from 'ws';
import { Server as HttpServer } from 'http';
import { parse } from 'url';
import { EventEmitter } from 'events';
import { CPEModel } from '../db/schemas/cpe.schema';
import { UDPClient } from '../udp/client';

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  cpeId?: string;
  timestamp: number;
  data?: {
    // Inform消息相关
    deviceInfo?: {
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
      softwareVersion?: string;
      hardwareVersion?: string;
      oui?: string;
      productClass?: string;
    };
    event?: string;
    parameterList?: string[];

    // 心跳消息相关
    status?: string;
    uptime?: number;
    metrics?: Record<string, any>;

    // 通用字段（IP和端口）
    udpPort?: number;
    localIp?: string;
    ipAddress?: string;

    // 其他可能的字段（保持向后兼容）
    [key: string]: any;
  };
  message?: string;
  status?: number;
  parameters?: Record<string, any>;
  command?: string;
  reason?: string;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, WS> = new Map();
  private sessions: Map<string, string> = new Map(); // sessionId -> cpeId
  private udpClient?: UDPClient; // 改为UDP客户端

  constructor(server: HttpServer) {
    super();
    this.wss = new WebSocketServer({ server });
    this.setupWebSocket();
  }

  // 注入UDP客户端
  public setUdpClient(udpClient: UDPClient) {
    this.udpClient = udpClient;
  }

  private setupWebSocket() {
    this.wss.on('connection', async (ws: WS, request) => {
      try {
        const url = parse(request.url || '', true);
        const cpeId = url.query.cpeId as string;
        const sessionId = url.query.sessionId as string;
        const reportedIp = url.query.ip as string;
        const udpPortStr = url.query.udpPort as string;

        if (!cpeId) {
          console.log(`⚠️  拒绝连接: 缺少cpeId参数`);
          ws.close(1008, 'Missing cpeId');
          return;
        }

        // 获取客户端IP地址并处理IPv6
        let clientIp = request.socket.remoteAddress || 'unknown';
        if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
          clientIp = '127.0.0.1';
        }

        // 解析UDP端口
        let udpPort: number | undefined;
        if (udpPortStr) {
          udpPort = parseInt(udpPortStr);
          if (isNaN(udpPort)) {
            console.log(`⚠️  无效的UDP端口: ${udpPortStr}`);
            udpPort = undefined;
          }
        }

        console.log(
          `🔗 CPE连接: ${cpeId}, 连接IP: ${clientIp}, 上报IP: ${reportedIp || '未上报'}, UDP端口: ${udpPort || '未上报'}`,
        );

        // 1. 立即设置消息处理器（放在最前面）
        ws.on('message', async (data: Buffer) => {
          const messageStr = data.toString();

          // 注释掉原始消息打印（保留但注释）
          // console.log(
          //   `📨 收到来自 ${cpeId} 的原始消息: ${messageStr.substring(0, 200)}${messageStr.length > 200 ? '...' : ''}`,
          // );

          try {
            const data: WebSocketMessage = JSON.parse(messageStr); // 解析消息

            // 获取消息中的IP和端口信息
            const reportedIp =
              data.data?.localIp || data.data?.ipAddress || '未上报';
            const udpPort = data.data?.udpPort || '未上报';

            // 简化的消息类型打印，包含IP和UDP端口
            console.log(
              `📨 收到来自 ${cpeId} 的消息类型: ${data.type}, 上报IP: ${reportedIp}, UDP端口: ${udpPort}`,
            );

            await this.handleMessage(cpeId, data); // 传递解析后的对象
          } catch (error) {
            console.error(`❌ 解析CPE ${cpeId} 消息错误:`, error);
          }
        });

        // 2. 存储连接
        this.connections.set(cpeId, ws);
        if (sessionId) {
          this.sessions.set(sessionId, cpeId);
        }

        // 3. 设置其他事件处理器
        ws.on('close', async () => {
          console.log(`🔌 CPE ${cpeId} 连接关闭`);
          await this.handleDisconnection(cpeId);
        });

        ws.on('error', (error) => {
          console.error(`❌ CPE ${cpeId} WebSocket错误:`, error);
        });

        // 4. 异步更新CPE状态
        setTimeout(async () => {
          try {
            await this.updateCPEStatus(
              cpeId,
              'connected',
              ws,
              sessionId,
              clientIp,
              reportedIp,
              udpPort,
            );
          } catch (error) {
            console.error(`❌ 更新CPE ${cpeId} 状态失败:`, error);
          }
        }, 0);

        // 5. 立即发送连接确认
        const ackMessage = {
          type: 'connection_ack',
          message: 'WebSocket连接已建立',
          timestamp: Date.now(),
        };

        console.log(`📤 发送连接确认到 ${cpeId}`);
        if (this.sendToCPE(cpeId, ackMessage)) {
          console.log(`✅ 连接确认已发送到 ${cpeId}`);
        } else {
          console.log(`❌ 无法发送连接确认到 ${cpeId}`);
        }

        this.emit('cpeConnected', cpeId);
      } catch (error) {
        console.error('WebSocket连接错误:', error);
        ws.close(1011, 'Internal error');
      }
    });

    console.log('✅ WebSocket服务器已启动，等待CPE连接...');
  }

  private async updateCPEStatus(
    cpeId: string,
    status: 'connecting' | 'connected' | 'registered' | 'disconnected',
    ws?: WS,
    sessionId?: string,
    clientIp?: string, // 从WebSocket连接获取的客户端IP
    reportedIp?: string, // CPE上报的IP地址
    udpPort?: number, // CPE上报的UDP端口（可选）
  ) {
    const updateData: any = {
      connectionStatus: status,
      lastSeen: new Date(),
    };

    // IP地址优先级：CPE上报的IP > WebSocket连接IP
    if (reportedIp) {
      updateData.ipAddress = reportedIp;
    } else if (clientIp) {
      updateData.ipAddress = clientIp;
    }

    // UDP端口（如果有）
    if (udpPort) {
      updateData.wakeupPort = udpPort;
    }

    if (sessionId) {
      updateData.sessionId = sessionId;
    }

    if (ws) {
      updateData.wsInfo = {
        readyState: ws.readyState,
        protocol: ws.protocol,
      };
    }

    await CPEModel.findOneAndUpdate({ cpeId }, updateData, {
      upsert: true,
      new: true,
    });

    // 构建日志消息
    let logMessage = `📊 CPE ${cpeId} 状态更新为: ${status}`;

    if (updateData.ipAddress) {
      logMessage += `, IP: ${updateData.ipAddress}`;
    }

    if (udpPort) {
      logMessage += `, UDP端口: ${udpPort}`;
    } else if (updateData.wakeupPort) {
      // 如果udpPort参数为空，但updateData中有wakeupPort（可能来自数据库已有数据或默认值）
      logMessage += `, UDP端口: ${updateData.wakeupPort}`;
    }

    console.log(logMessage);
  }

  // 处理TR-069消息
  private async handleMessage(
    cpeId: string,
    data: WebSocketMessage,
  ): Promise<void> {
    try {
      // 注释掉原来的详细打印
      // console.log(`📨 处理CPE ${cpeId} 的${data.type}消息`);

      switch (data.type) {
        case 'inform':
          await this.handleInform(cpeId, data);
          break;
        case 'heartbeat':
          await this.handleHeartbeat(cpeId, data);
          break;
        case 'getParameterValues':
          await this.handleGetParameterValues(cpeId, data);
          break;
        case 'setParameterValues':
          await this.handleSetParameterValues(cpeId, data);
          break;
        case 'download':
          await this.handleDownload(cpeId, data);
          break;
        case 'upload':
          await this.handleUpload(cpeId, data);
          break;
        default:
          console.warn(`❓ 未知消息类型 from ${cpeId}: ${data.type}`);
      }

      this.emit('messageReceived', cpeId, data);
    } catch (error) {
      console.error(`❌ 处理CPE ${cpeId} 消息错误:`, error);
    }
  }

  // TR-069 Inform处理
  private async handleInform(cpeId: string, data: WebSocketMessage) {
    console.log(`📞 处理CPE ${cpeId} 的Inform消息`);

    // 解析设备信息
    const deviceInfo = data.data?.deviceInfo || {};
    // 获取CPE上报的UDP端口（如果消息中有的话）
    const udpPort = data.data?.udpPort || 7548;
    // 获取CPE上报的IP地址（如果消息中有的话）
    const reportedIp = data.data?.localIp || data.data?.ipAddress;

    // 打印上报的IP和端口信息
    console.log(`  上报IP: ${reportedIp || '未上报'}, UDP端口: ${udpPort}`);

    const updateData: any = {
      connectionStatus: 'registered',
      manufacturer: deviceInfo.manufacturer,
      model: deviceInfo.model,
      softwareVersion: deviceInfo.softwareVersion,
      hardwareVersion: deviceInfo.hardwareVersion,
      serialNumber: deviceInfo.serialNumber,
      oui: deviceInfo.oui,
      productClass: deviceInfo.productClass,
      lastSeen: new Date(),
      firstSeen: new Date(),
      // 设置UDP端口
      wakeupPort: udpPort,
    };

    // 如果CPE上报了IP地址，使用它
    if (reportedIp) {
      updateData.ipAddress = reportedIp;
    }

    await CPEModel.findOneAndUpdate({ cpeId }, updateData, {
      upsert: true,
      new: true,
    });

    // 调用updateCPEStatus来打印状态更新日志
    // 传递必要的参数：状态为'registered'，上报的IP和UDP端口
    await this.updateCPEStatus(
      cpeId,
      'registered',
      undefined, // ws参数（不需要）
      data.sessionId, // sessionId参数
      undefined, // clientIp参数（使用上报的IP）
      reportedIp, // reportedIp参数
      udpPort, // udpPort参数
    );

    // 发送Inform响应
    this.sendToCPE(cpeId, {
      type: 'informResponse',
      sessionId: data.sessionId,
      status: 0,
      timestamp: Date.now(),
    });
  }

  // 心跳处理
  // eslint-disable-next-line
  private async handleHeartbeat(cpeId: string, data: WebSocketMessage) {
    const heartbeatData = data.data || {};

    const updateData: any = {
      lastHeartbeat: new Date(),
      lastSeen: new Date(),
    };

    // 如果心跳中包含UDP端口，更新它
    if (heartbeatData.udpPort !== undefined) {
      updateData.wakeupPort = heartbeatData.udpPort;
    }

    // 如果心跳中包含IP地址，更新它
    if (heartbeatData.localIp || heartbeatData.ipAddress) {
      const newIp = heartbeatData.localIp || heartbeatData.ipAddress;
      updateData.ipAddress = newIp;
      console.log(`🔄 CPE ${cpeId} 心跳上报新IP地址: ${newIp}`);
    }

    await CPEModel.findOneAndUpdate({ cpeId }, updateData);

    // 发送心跳响应
    this.sendToCPE(cpeId, {
      type: 'heartbeatResponse',
      timestamp: Date.now(),
    });
  }

  private async handleGetParameterValues(
    cpeId: string,
    data: WebSocketMessage,
  ) {
    // 实现参数获取逻辑
    const cpe = await CPEModel.findOne({ cpeId });

    this.sendToCPE(cpeId, {
      type: 'getParameterValuesResponse',
      sessionId: data.sessionId,
      parameters: cpe?.currentConfig || {},
      timestamp: Date.now(),
    });
  }

  private async handleSetParameterValues(
    cpeId: string,
    data: WebSocketMessage,
  ) {
    // 实现参数设置逻辑
    const parameters = data.data?.parameters || {};

    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        $set: { currentConfig: parameters },
        lastConfigUpdate: new Date(),
      },
    );

    this.sendToCPE(cpeId, {
      type: 'setParameterValuesResponse',
      sessionId: data.sessionId,
      status: 0,
      timestamp: Date.now(),
    });
  }

  private async handleDownload(cpeId: string, data: WebSocketMessage) {
    // 实现文件下载逻辑
    console.log(`📥 CPE ${cpeId} 请求下载:`, data.data?.fileUrl);
  }

  // eslint-disable-next-line
  private async handleUpload(cpeId: string, data: WebSocketMessage) {
    // 实现文件上传逻辑
    console.log(`📤 CPE ${cpeId} 请求上传`);
  }

  private async handleDisconnection(cpeId: string) {
    this.connections.delete(cpeId);

    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        connectionStatus: 'disconnected',
        wsConnectionId: null,
      },
    );

    console.log(`❌ CPE ${cpeId} 断开连接`);
    this.emit('cpeDisconnected', cpeId);
  }

  // 发送消息到CPE
  public sendToCPE(cpeId: string, message: WebSocketMessage): boolean {
    const ws = this.connections.get(cpeId);
    if (ws && ws.readyState === ws.OPEN) {
      // 注释掉发送消息的日志，只在必要时开启
      // console.log(`📤 发送消息到 ${cpeId}: ${message.type}`);
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // 唤醒CPE（通过UDP客户端发送唤醒包）
  public async wakeCPE(cpeId: string): Promise<boolean> {
    const cpe = await CPEModel.findOne({ cpeId });
    if (!cpe?.ipAddress) {
      console.error(`❌ 无法唤醒CPE ${cpeId}: 无IP地址`);
      return false;
    }

    if (this.udpClient) {
      // 更新最后唤醒时间
      await CPEModel.findOneAndUpdate(
        { cpeId },
        { lastWakeupCall: new Date() },
      );

      const success = await this.udpClient.wakeUpCPE(
        cpe.ipAddress,
        cpe.wakeupPort || 7548,
        {
          type: 'wakeup',
          command: 'connectToACS',
          acsUrl: 'ws://localhost:7547',
          timestamp: Date.now(),
          cpeId,
        },
      );

      if (success) {
        console.log(
          `📢 已发送唤醒包到 ${cpe.ipAddress}:${cpe.wakeupPort || 7548}`,
        );
      }

      return success;
    }

    return false;
  }

  public getConnectedCPEs(): string[] {
    return Array.from(this.connections.keys());
  }

  public close() {
    this.wss.close();
    this.connections.clear();
    this.sessions.clear();
  }
}
