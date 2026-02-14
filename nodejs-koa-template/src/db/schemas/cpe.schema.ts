// /src/db/schemas/cpe.schema.ts - 扩展版
import { Schema, model } from 'mongoose';

// 流量统计接口
export interface ITrafficStat {
  timestamp: Date; // 统计时段开始时间
  uploadBytes: number; // 上行字节数
  downloadBytes: number; // 下行字节数
  connectionType?: string; // 连接类型（wifi/4G/5G）
}

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

  // 统计信息 - 重命名 rebootCount 为 bootCount
  uptime: number;
  bootCount: number; // 修改：从 rebootCount 改为 bootCount
  lastBoot?: Date;

  // === 新增字段（2.0版本）===
  // 在线状态（按需计算）
  onlineStatus?: 'online' | 'offline';
  onlineStatusUpdatedAt?: Date;

  // 心跳统计
  heartbeatCount: number;

  // 流量统计（心跳上报）
  trafficStats: ITrafficStat[];

  // 网络质量信息
  signalStrength?: number; // 信号强度(dBm)
  cellId?: string; // 蜂窝小区ID
  networkType?: string; // 网络类型(4G/5G/5G+)

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
    bootCount: {
      // 修改：从 rebootCount 改为 bootCount
      type: Number,
      default: 0,
    },
    lastBoot: Date,

    // === 新增字段（2.0版本）===
    onlineStatus: {
      type: String,
      enum: ['online', 'offline'],
      index: true, // 添加索引，便于查询
    },
    onlineStatusUpdatedAt: {
      type: Date,
      index: true, // 添加索引，便于按时间范围查询
    },
    heartbeatCount: {
      type: Number,
      default: 0,
    },
    trafficStats: [
      {
        timestamp: {
          type: Date,
          required: true,
        },
        uploadBytes: {
          type: Number,
          required: true,
          min: 0,
        },
        downloadBytes: {
          type: Number,
          required: true,
          min: 0,
        },
        connectionType: {
          type: String,
          enum: ['wifi', '4G', '5G', '5G+', 'ethernet'],
        },
      },
    ],
    signalStrength: {
      type: Number,
      min: -150,
      max: -30,
    },
    cellId: String,
    networkType: {
      type: String,
      enum: ['2G', '3G', '4G', '5G', '5G+', 'wifi'],
    },

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

// 索引优化（新增索引）
cpeSchema.index({ connectionStatus: 1, lastSeen: -1 });
cpeSchema.index({ ipAddress: 1 });
cpeSchema.index({ lastHeartbeat: 1 });
cpeSchema.index({ manufacturer: 1, model: 1 });
cpeSchema.index({ lastSeen: -1 }); // 用于在线状态计算
cpeSchema.index({ 'trafficStats.timestamp': -1 }); // 用于流量统计查询
cpeSchema.index({ cellId: 1 }); // 用于按小区查询设备

export const CPEModel = model<ICPE>('CPE', cpeSchema);
