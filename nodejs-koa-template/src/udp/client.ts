/* eslint-disable no-console */
// /src/udp/client.ts - ACS侧的UDP客户端（用于发送唤醒包）
import dgram from 'dgram';

export interface UDPWakeupMessage {
  type: 'wakeup';
  command: 'connectToACS';
  acsUrl: string;
  timestamp: number;
  cpeId?: string;
}

export class UDPClient {
  private client: dgram.Socket;

  constructor() {
    this.client = dgram.createSocket('udp4');
  }

  // 发送唤醒包到CPE
  public async wakeUpCPE(
    cpeIp: string,
    cpePort: number = 7548,
    message?: UDPWakeupMessage,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const wakeupMessage: UDPWakeupMessage = message || {
        type: 'wakeup',
        command: 'connectToACS',
        acsUrl: 'ws://localhost:7547',
        timestamp: Date.now(),
      };

      const messageStr = JSON.stringify(wakeupMessage);

      this.client.send(messageStr, cpePort, cpeIp, (error) => {
        if (error) {
          console.error(`❌ 发送UDP唤醒包失败 to ${cpeIp}:${cpePort}:`, error);
          resolve(false);
        } else {
          console.log(`📢 已发送UDP唤醒包到 ${cpeIp}:${cpePort}`);
          resolve(true);
        }
      });
    });
  }

  // 发送批量唤醒
  public async wakeUpMultipleCPEs(
    cpeList: Array<{ ip: string; port?: number }>,
  ): Promise<number> {
    let successCount = 0;

    for (const cpe of cpeList) {
      const success = await this.wakeUpCPE(cpe.ip, cpe.port);
      if (success) successCount++;
      // 避免同时发送太多，间隔100ms
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return successCount;
  }

  public close() {
    this.client.close();
  }
}
