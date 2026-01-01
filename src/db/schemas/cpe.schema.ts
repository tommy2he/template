// /src/db/schemas/cpe.schema.ts - 最终版
import { Schema, model } from 'mongoose';

export interface ICPE {
  // 标识信息
  cpeId: string;
  deviceId: string;
  serialNumber?: string;
  macAddress?: string;

  // 连接状态
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'registered';
  wsConnectionId?: string;
  sessionId?: string;

  // TR-069标准信息
  oui?: string;
  productClass?: string;
  softwareVersion?: string;
  hardwareVersion?: string;

  // 设备信息
  manufacturer?: string;
  model?: string;
  ipAddress?: string;

  // 网络信息
  capabilities: string[];

  // 配置管理
  currentConfig: Record<string, any>;
  pendingConfig?: Record<string, any>;
  lastConfigUpdate?: Date;

  // 心跳管理
  lastHeartbeat: Date;
  heartbeatInterval: number;

  // 唤醒信息
  lastWakeupCall?: Date;
  wakeupPort?: number;

  // 元数据
  metadata: Record<string, any>;

  // 统计信息
  uptime: number;
  rebootCount: number;
  lastBoot?: Date;

  // 时间戳
  firstSeen: Date;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cpeSchema = new Schema<ICPE>(
  {
    cpeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    serialNumber: String,
    macAddress: String,

    connectionStatus: {
      type: String,
      enum: ['disconnected', 'connecting', 'connected', 'registered'],
      default: 'disconnected',
    },
    wsConnectionId: String,
    sessionId: String,

    // TR-069
    oui: String,
    productClass: String,
    softwareVersion: String,
    hardwareVersion: String,

    manufacturer: String,
    model: String,
    ipAddress: String,

    capabilities: [String],

    currentConfig: {
      type: Schema.Types.Mixed,
      default: {},
    },
    pendingConfig: Schema.Types.Mixed,
    lastConfigUpdate: Date,

    lastHeartbeat: {
      type: Date,
      default: Date.now,
    },
    heartbeatInterval: {
      type: Number,
      default: 30,
    },

    lastWakeupCall: Date,
    wakeupPort: {
      type: Number,
      default: 7548,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    uptime: {
      type: Number,
      default: 0,
    },
    rebootCount: {
      type: Number,
      default: 0,
    },
    lastBoot: Date,

    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// 索引优化
cpeSchema.index({ connectionStatus: 1, lastSeen: -1 });
cpeSchema.index({ ipAddress: 1 });
cpeSchema.index({ lastHeartbeat: 1 });
cpeSchema.index({ manufacturer: 1, model: 1 });

export const CPEModel = model<ICPE>('CPE', cpeSchema);
