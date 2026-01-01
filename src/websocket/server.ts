/* eslint-disable no-console */
import { Server as WebSocketServer, WebSocket as WS } from 'ws';
import { Server as HttpServer } from 'http';
import { parse } from 'url';
import jwt from 'jsonwebtoken';
import { CPEModel } from '../db/schemas/cpe.schema';

// 定义WebSocket消息类型
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private connections: Map<string, WS> = new Map();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', async (ws: WS, request) => {
      try {
        // 解析查询参数
        const url = parse(request.url || '', true);
        const token = url.query.token as string;
        const cpeId = url.query.cpeId as string;

        if (!token || !cpeId) {
          ws.close(1008, 'Missing token or cpeId');
          return;
        }

        // 验证JWT令牌
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'secret',
        ) as { cpeId: string };

        if (decoded.cpeId !== cpeId) {
          ws.close(1008, 'Invalid token');
          return;
        }

        // 更新CPE连接状态
        await CPEModel.findOneAndUpdate(
          { cpeId },
          {
            connectionStatus: 'connected',
            wsConnectionId: cpeId, // 使用cpeId作为连接ID
            lastSeen: new Date(),
          },
        );

        // 存储连接
        this.connections.set(cpeId, ws);

        console.log(`✅ CPE connected: ${cpeId}`);

        // 设置消息处理器
        ws.on('message', async (data: Buffer) => {
          await this.handleMessage(cpeId, data.toString());
        });

        // 设置关闭处理器
        ws.on('close', async () => {
          await this.handleDisconnection(cpeId);
        });

        // 错误处理
        ws.on('error', (error) => {
          console.error(`WebSocket error for ${cpeId}:`, error);
        });

        // 发送欢迎消息
        ws.send(
          JSON.stringify({
            type: 'welcome',
            message: 'Connected to Koa Template App',
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal error');
      }
    });
  }

  private async handleMessage(cpeId: string, message: string) {
    try {
      const data: WebSocketMessage = JSON.parse(message);

      switch (data.type) {
        case 'heartbeat':
          await this.handleHeartbeat(cpeId, data);
          break;
        case 'status':
          await this.handleStatusUpdate(cpeId, data);
          break;
        case 'configuration_ack':
          await this.handleConfigurationAck(cpeId, data);
          break;
        default:
          console.warn(`Unknown message type from ${cpeId}: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${cpeId}:`, error);
    }
  }

  // eslint-disable-next-line
  private async handleHeartbeat(cpeId: string, data: WebSocketMessage) {
    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        lastHeartbeat: new Date(),
        lastSeen: new Date(),
      },
    );

    // 向CPE发送响应
    const ws = this.connections.get(cpeId);
    if (ws) {
      ws.send(
        JSON.stringify({
          type: 'heartbeat_ack',
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  private async handleStatusUpdate(cpeId: string, data: WebSocketMessage) {
    // 这里可以处理设备状态上报
    console.log(`Status update from ${cpeId}:`, data);

    // 可以存储状态到数据库，或转发到其他服务
    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        lastSeen: new Date(),
        metadata: {
          ...data.metadata,
          lastStatusUpdate: new Date(),
        },
      },
    );
  }

  private async handleConfigurationAck(cpeId: string, data: WebSocketMessage) {
    console.log(`Configuration acknowledged by ${cpeId}:`, data);

    // 更新配置状态
    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        configuration: data.configuration || {},
        pendingConfiguration: null,
        lastSeen: new Date(),
      },
    );
  }

  private async handleDisconnection(cpeId: string) {
    this.connections.delete(cpeId);

    await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        connectionStatus: 'offline',
        wsConnectionId: null,
        $inc: { reconnectAttempts: 1 },
      },
    );

    console.log(`❌ CPE disconnected: ${cpeId}`);
  }

  // 向特定CPE发送消息
  public async sendToCPE(
    cpeId: string,
    message: WebSocketMessage,
  ): Promise<boolean> {
    const ws = this.connections.get(cpeId);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // 广播消息给所有CPE
  public broadcast(message: WebSocketMessage) {
    this.connections.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  // 获取所有连接的CPE
  public getConnectedCPEs(): string[] {
    return Array.from(this.connections.keys());
  }

  // 关闭WebSocket服务器
  public close() {
    this.wss.close();
    this.connections.clear();
  }
}
