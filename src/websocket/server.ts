/* eslint-disable no-console */

// /src/websocket/server.ts - 增强版WebSocket服务器
import { Server as WebSocketServer, WebSocket as WS } from 'ws';
import { Server as HttpServer } from 'http';
import { parse } from 'url';
import { EventEmitter } from 'events';
import { CPEModel } from '../db/schemas/cpe.schema';

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  cpeId?: string;
  timestamp: number;
  data?: any;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, WS> = new Map();
  private sessions: Map<string, string> = new Map(); // sessionId -> cpeId
  private udpServer?: any;

  constructor(server: HttpServer) {
    super();
    this.wss = new WebSocketServer({ server });
    this.setupWebSocket();
  }

  // 注入UDP服务器实例
  public setUdpServer(udpServer: any) {
    this.udpServer = udpServer;
  }

  private setupWebSocket() {
    this.wss.on('connection', async (ws: WS, request) => {
      try {
        const url = parse(request.url || '', true);
        const cpeId = url.query.cpeId as string;
        const sessionId = url.query.sessionId as string;

        if (!cpeId) {
          ws.close(1008, 'Missing cpeId');
          return;
        }

        console.log(`🔗 CPE连接: ${cpeId}, 会话: ${sessionId || '新会话'}`);

        // 存储连接
        this.connections.set(cpeId, ws);
        if (sessionId) {
          this.sessions.set(sessionId, cpeId);
        }

        // 更新CPE状态
        await this.updateCPEStatus(cpeId, 'connected', ws, sessionId);

        // 设置消息处理器
        ws.on('message', async (data: Buffer) => {
          await this.handleMessage(cpeId, data.toString());
        });

        ws.on('close', async () => {
          await this.handleDisconnection(cpeId);
        });

        ws.on('error', (error) => {
          console.error(`❌ CPE ${cpeId} WebSocket错误:`, error);
        });

        // 发送连接确认
        this.sendToCPE(cpeId, {
          type: 'connection_ack',
          message: 'WebSocket连接已建立',
          timestamp: Date.now(),
        });

        this.emit('cpeConnected', cpeId);
      } catch (error) {
        console.error('WebSocket连接错误:', error);
        ws.close(1011, 'Internal error');
      }
    });
  }

  private async updateCPEStatus(
    cpeId: string,
    status: 'connecting' | 'connected' | 'registered' | 'disconnected',
    ws?: WS,
    sessionId?: string,
  ) {
    const updateData: any = {
      connectionStatus: status,
      lastSeen: new Date(),
    };

    if (sessionId) {
      updateData.sessionId = sessionId;
    }

    if (ws) {
      // 存储WebSocket相关信息
      updateData.wsInfo = {
        readyState: ws.readyState,
        protocol: ws.protocol,
      };
    }

    await CPEModel.findOneAndUpdate({ cpeId }, updateData, {
      upsert: true,
      new: true,
    });

    console.log(`📊 CPE ${cpeId} 状态更新为: ${status}`);
  }

  // 处理TR-069消息
  private async handleMessage(cpeId: string, message: string) {
    try {
      const data: WebSocketMessage = JSON.parse(message);
      console.log(`📨 收到来自 ${cpeId} 的消息:`, data.type);

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
          console.warn(`未知消息类型 from ${cpeId}: ${data.type}`);
      }

      this.emit('messageReceived', cpeId, data);
    } catch (error) {
      console.error(`处理CPE ${cpeId} 消息错误:`, error);
    }
  }

  // TR-069 Inform处理
  private async handleInform(cpeId: string, data: WebSocketMessage) {
    console.log(`📞 处理CPE ${cpeId} 的Inform消息`);

    // 解析设备信息
    const deviceInfo = data.data?.deviceInfo || {};

    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        connectionStatus: 'registered',
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        softwareVersion: deviceInfo.softwareVersion,
        hardwareVersion: deviceInfo.hardwareVersion,
        serialNumber: deviceInfo.serialNumber,
        oui: deviceInfo.oui,
        productClass: deviceInfo.productClass,
        lastSeen: new Date(),
        firstSeen: new Date(), // 如果是第一次，设置首次发现时间
      },
      { upsert: true, new: true },
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
  private async handleHeartbeat(cpeId: string, data: WebSocketMessage) {
    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        lastHeartbeat: new Date(),
        lastSeen: new Date(),
      },
    );

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
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // 唤醒CPE（通过UDP）
  public async wakeCPE(cpeId: string): Promise<boolean> {
    const cpe = await CPEModel.findOne({ cpeId });
    if (!cpe?.ipAddress) {
      console.error(`❌ 无法唤醒CPE ${cpeId}: 无IP地址`);
      return false;
    }

    if (this.udpServer) {
      this.udpServer.wakeUpCPE(cpe.ipAddress, 7548);
      return true;
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
