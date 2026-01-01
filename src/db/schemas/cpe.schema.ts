import { Schema, model } from 'mongoose';

export interface ICPE {
  deviceId: string; // 关联的设备ID
  cpeId: string; // CPE唯一标识
  connectionStatus: 'offline' | 'connecting' | 'connected' | 'registered';
  wsConnectionId?: string; // WebSocket连接ID
  lastHeartbeat: Date; // 最后心跳时间
  heartbeatInterval: number; // 心跳间隔(秒)
  reconnectAttempts: number; // 重连尝试次数
  lastSeen: Date; // 最后通信时间
  capabilities: string[]; // 支持的设备能力
  configuration: Record<string, any>; // 当前配置
  pendingConfiguration?: Record<string, any>; // 待下发配置
  metadata: Record<string, any>; // 元数据
}

const cpeSchema = new Schema<ICPE>(
  {
    deviceId: {
      type: String,
      required: true,
      ref: 'Device',
      index: true,
    },
    cpeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    connectionStatus: {
      type: String,
      enum: ['offline', 'connecting', 'connected', 'registered'],
      default: 'offline',
    },
    wsConnectionId: {
      type: String,
      sparse: true,
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
    },
    heartbeatInterval: {
      type: Number,
      default: 30, // 默认30秒
    },
    reconnectAttempts: {
      type: Number,
      default: 0,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    capabilities: [
      {
        type: String,
      },
    ],
    configuration: {
      type: Schema.Types.Mixed,
      default: {},
    },
    pendingConfiguration: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// 索引
cpeSchema.index({ connectionStatus: 1 });
cpeSchema.index({ lastHeartbeat: 1 });
cpeSchema.index({ lastSeen: -1 });

export const CPEModel = model<ICPE>('CPE', cpeSchema);
