// /src/udp/server.ts - UDP唤醒服务器
/* eslint-disable no-console */
import dgram from 'dgram';
import { EventEmitter } from 'events';

export interface UDPMessage {
  type: 'inform' | 'heartbeat' | 'discovery';
  cpeId: string;
  ipAddress: string;
  macAddress: string;
  timestamp: number;
  data?: any;
}

export class UDPServer extends EventEmitter {
  private server: dgram.Socket;
  private port: number;

  constructor(port: number = 7548) {
    super();
    this.port = port;
    this.server = dgram.createSocket('udp4');
    this.setupServer();
  }

  private setupServer() {
    this.server.on('message', (msg, rinfo) => {
      try {
        const message = JSON.parse(msg.toString()) as UDPMessage;
        console.log(
          `📡 UDP收到消息 from ${rinfo.address}:${rinfo.port}:`,
          message,
        );

        // 触发事件
        this.emit('message', message, rinfo);

        // 根据消息类型处理
        switch (message.type) {
          case 'inform':
            this.handleInform(message, rinfo);
            break;
          case 'discovery':
            this.handleDiscovery(message, rinfo);
            break;
          case 'heartbeat':
            this.handleHeartbeat(message, rinfo);
            break;
        }
      } catch (error) {
        console.error('❌ UDP消息解析失败:', error);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`🚀 UDP服务器监听在 ${address.address}:${address.port}`);
    });

    this.server.on('error', (error) => {
      console.error('❌ UDP服务器错误:', error);
    });
  }

  private handleInform(message: UDPMessage, rinfo: dgram.RemoteInfo) {
    console.log(`📞 CPE ${message.cpeId} 发送Inform消息`);
    // 这里可以触发WebSocket连接尝试
    this.emit('cpeInform', message, rinfo);
  }

  private handleDiscovery(message: UDPMessage, rinfo: dgram.RemoteInfo) {
    console.log(`🔍 CPE ${message.cpeId} 发送Discovery消息`);
    // 发送ACS位置信息
    const response = {
      type: 'acsLocation',
      acsUrl: 'ws://localhost:7547',
      timestamp: Date.now(),
    };
    this.sendResponse(rinfo, response);
  }

  private handleHeartbeat(message: UDPMessage, rinfo: dgram.RemoteInfo) {
    console.log(`💓 CPE ${message.cpeId} 心跳`);
    // 可以更新CPE状态
    this.emit('cpeHeartbeat', message, rinfo);
  }

  private sendResponse(rinfo: dgram.RemoteInfo, data: any) {
    const message = JSON.stringify(data);
    this.server.send(message, rinfo.port, rinfo.address);
  }

  // 发送UDP唤醒包到CPE
  public wakeUpCPE(cpeIp: string, cpePort: number = 7548) {
    const wakeupMessage = {
      type: 'wakeup',
      command: 'connectToACS',
      acsUrl: 'ws://localhost:7547',
      timestamp: Date.now(),
    };

    this.server.send(JSON.stringify(wakeupMessage), cpePort, cpeIp, (error) => {
      if (error) {
        console.error(`❌ 发送唤醒包失败 to ${cpeIp}:${cpePort}:`, error);
      } else {
        console.log(`📢 已发送唤醒包到 ${cpeIp}:${cpePort}`);
      }
    });
  }

  public start() {
    this.server.bind(this.port);
  }

  public stop() {
    this.server.close();
  }
}
