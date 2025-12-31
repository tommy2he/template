import { Schema } from 'mongoose';

// 定义 Device 文档接口
export interface IDeviceDocument {
  deviceId: string;
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'provisioning' | 'maintenance';
  lastSeen: Date;
  parameters: Map<string, any>;
  tags: string[];
  metadata: Map<string, any>;
  createdAt: Date;
  updatedAt: Date;
  _id: any;
  __v?: number; // 添加这个属性声明
}

export const DeviceSchema = new Schema<IDeviceDocument>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // index: true,  // 移除这一行，因为下面已经定义了索引
    },
    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    firmwareVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    ipAddress: {
      type: String,
      required: true,
      match: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'provisioning', 'maintenance'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    parameters: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
  },
  {
    timestamps: true, // 自动添加 createdAt 和 updatedAt
    toJSON: {
      virtuals: true,
      transform: (doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

// 添加索引
// DeviceSchema.index({ deviceId: 1 }, { unique: true });
DeviceSchema.index({ status: 1 });
DeviceSchema.index({ lastSeen: -1 });
DeviceSchema.index({ 'parameters._id': 1 });
DeviceSchema.index({ tags: 1 });
