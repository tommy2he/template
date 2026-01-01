// /cpe/src/udp-client.ts - CPE UDP客户端
/* eslint-disable no-console */
import dgram from 'dgram';
import { EventEmitter } from 'events';

export interface UDPMessage {
  type: string;
  timestamp: number;
  data?: any;
}

export class UDPClient extends EventEmitter {
  private client: dgram.Socket;
  private port: number;
  private acsIp: string;
  private acsPort: number;

  constructor(acsIp: string = 'localhost', acsPort: number = 7548) {
    super();
    this.acsIp = acsIp;
    this.acsPort = acsPort;
    this.port = 7548; // CPE监听端口
    this.client = dgram.createSocket('udp4');
    this.setupClient();
  }

  private setupClient() {
    // 监听UDP消息（用于被ACS唤醒）
    this.client.on('message', (msg, rinfo) => {
      try {
        const message = JSON.parse(msg.toString()) as UDPMessage;
        console.log(
          `📡 收到UDP消息 from ${rinfo.address}:${rinfo.port}:`,
          message,
        );

        // 触发事件
        this.emit('message', message, rinfo);

        // 处理唤醒消息
        if (message.type === 'wakeup') {
          console.log('🔔 收到ACS唤醒指令');
          this.emit('wakeup', message.data);
        }
      } catch (error) {
        console.error('❌ UDP消息解析失败:', error);
      }
    });

    this.client.on('listening', () => {
      const address = this.client.address();
      console.log(`🎧 UDP客户端监听在 ${address.address}:${address.port}`);
    });

    this.client.on('error', (error) => {
      console.error('❌ UDP客户端错误:', error);
    });

    // 绑定端口
    this.client.bind(this.port);
  }

  // 发送Inform消息到ACS（CPE启动时发送）
  public sendInform(cpeId: string, deviceInfo: any) {
    const message: UDPMessage = {
      type: 'inform',
      timestamp: Date.now(),
      data: {
        cpeId,
        deviceInfo,
      },
    };

    this.sendMessage(message);
  }

  // 发送Discovery消息（发现ACS）
  public sendDiscovery(cpeId: string) {
    const message: UDPMessage = {
      type: 'discovery',
      timestamp: Date.now(),
      data: { cpeId },
    };

    this.sendMessage(message);
  }

  // 发送心跳
  public sendHeartbeat(cpeId: string) {
    const message: UDPMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      data: { cpeId, status: 'alive' },
    };

    this.sendMessage(message);
  }

  private sendMessage(message: UDPMessage) {
    const msgStr = JSON.stringify(message);
    this.client.send(msgStr, this.acsPort, this.acsIp, (error) => {
      if (error) {
        console.error('❌ 发送UDP消息失败:', error);
      } else {
        console.log(`📤 已发送UDP消息: ${message.type}`);
      }
    });
  }

  public close() {
    this.client.close();
  }
}
