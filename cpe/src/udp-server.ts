// /cpe/src/udp-server.ts - CPE侧的UDP服务器（监听唤醒）
/* eslint-disable no-console */
import dgram from 'dgram';
import { EventEmitter } from 'events';

export interface UDPMessage {
  type: string;
  command?: string;
  acsUrl?: string;
  timestamp: number;
  cpeId?: string;
}

export class UDPServer extends EventEmitter {
  private server: dgram.Socket;
  private port: number;
  private isListening: boolean = false;

  constructor(port: number = 7548) {
    super();
    this.port = port;
    this.server = dgram.createSocket('udp4');
    this.setupServer();
  }

  private setupServer() {
    this.server.on('message', (msg, rinfo) => {
      try {
        const message: UDPMessage = JSON.parse(msg.toString());
        console.log(
          `📡 收到UDP消息 from ${rinfo.address}:${rinfo.port}:`,
          message.type,
        );

        // 触发消息事件
        this.emit('message', message, rinfo);

        // 处理唤醒消息
        if (message.type === 'wakeup') {
          console.log('🔔 收到ACS唤醒指令');
          console.log(`   命令: ${message.command}`);
          console.log(`   ACS地址: ${message.acsUrl}`);
          this.emit('wakeup', message, rinfo);
        }
      } catch (error) {
        console.error('❌ UDP消息解析失败:', error);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.isListening = true;
      console.log(`🎧 UDP服务器监听在 ${address.address}:${address.port}`);
      this.emit('listening', address);
    });

    this.server.on('error', (error) => {
      console.error('❌ UDP服务器错误:', error);
      this.emit('error', error);
    });

    this.server.on('close', () => {
      this.isListening = false;
      console.log('🔒 UDP服务器已关闭');
      this.emit('closed');
    });
  }

  // 启动UDP服务器
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isListening) {
        resolve();
        return;
      }

      this.server.once('listening', () => {
        resolve();
      });

      this.server.once('error', (error) => {
        reject(error);
      });

      this.server.bind(this.port);
    });
  }

  // 关闭UDP服务器
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isListening) {
        resolve();
        return;
      }

      this.server.close(() => {
        resolve();
      });
    });
  }

  // 获取服务器状态
  public getStatus() {
    return {
      isListening: this.isListening,
      port: this.port,
      address: this.isListening ? this.server.address() : null,
    };
  }
}
