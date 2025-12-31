import { Context } from 'koa';
import { deviceRepository } from '../../db/repositories/DeviceRepository';
import { IDevice } from '../../db/models/Device';

export class DeviceController {
  // 获取设备列表
  static async getDevices(ctx: Context): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        sortBy = 'lastSeen',
        // sortOrder = '-1',
        // Fix the error when sort with LastSeen
        sortOrder = 'desc',
      } = ctx.query;

      // 参数验证和转换
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string) || 20),
      ); // 限制最大100条
      const skip = (pageNum - 1) * limitNum;

      const filter: any = {};
      if (status) {
        // 验证status是否有效
        const validStatuses = [
          'online',
          'offline',
          'provisioning',
          'maintenance',
        ];
        if (validStatuses.includes(status as string)) {
          filter.status = status;
        } else {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: `无效的status值: ${status}。有效值为: ${validStatuses.join(', ')}`,
          };
          return;
        }
      }

      const sort: Record<string, 1 | -1> = {};
      // sort[sortBy as string] = parseInt(sortOrder as string) as 1 | -1;
      // Fix the error when sort with LastSeen
      if (sortBy) {
        // 验证sortBy是否有效
        const validSortFields = [
          'lastSeen',
          'createdAt',
          'updatedAt',
          'deviceId',
          'manufacturer',
          'model',
          'status',
          'ipAddress',
        ];

        if (!validSortFields.includes(sortBy as string)) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: `无效的排序字段: ${sortBy}。有效字段为: ${validSortFields.join(', ')}`,
          };
          return;
        }

        // 解析排序方向
        const order = sortOrder === 'desc' ? -1 : 1;
        sort[sortBy as string] = order as 1 | -1;
      }

      const devices = await deviceRepository.findAll(filter, {
        skip,
        limit: limitNum,
        sort,
      });

      const total = await deviceRepository.count(filter);

      ctx.body = {
        success: true,
        data: devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 创建设备
  static async createDevice(ctx: Context): Promise<void> {
    try {
      const deviceData = ctx.request.body as Partial<IDevice>;

      // 验证必填字段
      if (!deviceData.deviceId) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'deviceId 是必填字段',
        };
        return;
      }

      // 检查设备是否已存在
      const existingDevice = await deviceRepository.findByDeviceId(
        deviceData.deviceId,
      );
      if (existingDevice) {
        ctx.status = 409;
        ctx.body = {
          success: false,
          error: '设备已存在',
        };
        return;
      }

      const device = await deviceRepository.create(deviceData);
      ctx.status = 201;
      ctx.body = {
        success: true,
        data: device,
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 获取单个设备
  // 获取单个设备 - 修改为按 deviceId 查询
  static async getDevice(ctx: Context): Promise<void> {
    try {
      const { id } = ctx.params;

      // 改为按 deviceId 查询，因为用户在实际应用中应该使用业务ID
      const device = await deviceRepository.findByDeviceId(id);

      if (!device) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '设备不存在',
        };
        return;
      }

      ctx.body = {
        success: true,
        data: device,
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 更新设备
  static async updateDevice(ctx: Context): Promise<void> {
    try {
      const { id } = ctx.params;
      const updateData = ctx.request.body as Partial<IDevice>;

      // 如果尝试更新 deviceId，检查是否冲突
      if (updateData.deviceId) {
        const existingDevice = await deviceRepository.findByDeviceId(
          updateData.deviceId,
        );
        if (existingDevice && existingDevice._id.toString() !== id) {
          ctx.status = 409;
          ctx.body = {
            success: false,
            error: 'deviceId 已存在',
          };
          return;
        }
      }

      const device = await deviceRepository.update(id, updateData);

      if (!device) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '设备不存在',
        };
        return;
      }

      ctx.body = {
        success: true,
        data: device,
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 删除设备
  static async deleteDevice(ctx: Context): Promise<void> {
    try {
      const { id } = ctx.params;
      const device = await deviceRepository.delete(id);

      if (!device) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '设备不存在',
        };
        return;
      }

      ctx.body = {
        success: true,
        message: '设备删除成功',
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 更新设备参数 - 也修正了findByDeviceId
  static async updateDeviceParameters(ctx: Context): Promise<void> {
    try {
      const { id } = ctx.params; // 这里的 id 应该是 deviceId
      const { parameters } = ctx.request.body as {
        parameters: Record<string, any>;
      };

      if (!parameters || typeof parameters !== 'object') {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'parameters 必须是有效的对象',
        };
        return;
      }

      // 修改：直接按 deviceId 查找设备
      const device = await deviceRepository.findByDeviceId(id);
      if (!device) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '设备不存在',
        };
        return;
      }

      const updatedDevice = await deviceRepository.updateParameters(
        device.deviceId, // 这里可以改为 id，因为 id 现在就是 deviceId
        parameters,
      );

      ctx.body = {
        success: true,
        data: updatedDevice,
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 搜索设备
  static async searchDevices(ctx: Context): Promise<void> {
    try {
      const { q, page = '1', limit = '20' } = ctx.query;

      if (!q || (q as string).trim() === '') {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '搜索关键词不能为空',
        };
        return;
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const devices = await deviceRepository.search(q as string, {
        skip,
        limit: parseInt(limit as string),
      });

      ctx.body = {
        success: true,
        data: devices,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: devices.length,
        },
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }

  // 获取设备统计信息
  static async getDeviceStats(ctx: Context): Promise<void> {
    try {
      const total = await deviceRepository.count();
      const online = await deviceRepository.countOnlineDevices();
      const offline = await deviceRepository.count({ status: 'offline' });
      const provisioning = await deviceRepository.count({
        status: 'provisioning',
      });
      const maintenance = await deviceRepository.count({
        status: 'maintenance',
      });

      ctx.body = {
        success: true,
        data: {
          total,
          online,
          offline,
          provisioning,
          maintenance,
          onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
        },
      };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message,
      };
    }
  }
}

export default DeviceController;
