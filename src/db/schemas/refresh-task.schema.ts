import { Schema, model } from 'mongoose';

export interface IRefreshTask {
  taskId: string;
  mode: 'normal' | 'force';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  totalDevices: number;
  processedDevices: number;
  operator?: string; // 未来扩展

  // 统计信息
  onlineCount: number;
  offlineCount: number;

  // 时间信息
  startedAt: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number; // 预估剩余时间（秒）

  // 错误信息
  error?: string;
  errorDetails?: any;
}

const refreshTaskSchema = new Schema<IRefreshTask>(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ['normal', 'force'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalDevices: {
      type: Number,
      default: 0,
    },
    processedDevices: {
      type: Number,
      default: 0,
    },
    operator: {
      type: String,
    },
    onlineCount: {
      type: Number,
      default: 0,
    },
    offlineCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    estimatedTimeRemaining: {
      type: Number,
    },
    error: {
      type: String,
    },
    errorDetails: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, // 自动添加 createdAt 和 updatedAt
  },
);

// 添加索引以便快速查询
refreshTaskSchema.index({ taskId: 1 });
refreshTaskSchema.index({ status: 1 });
refreshTaskSchema.index({ startedAt: -1 });
refreshTaskSchema.index({ operator: 1 });

export const RefreshTaskModel = model<IRefreshTask>(
  'RefreshTask',
  refreshTaskSchema,
);
