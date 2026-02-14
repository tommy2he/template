import { Device, IDevice } from '../models/Device';

export class DeviceRepository {
  async create(deviceData: Partial<IDevice>): Promise<IDevice> {
    const device = new Device(deviceData);
    return await device.save();
  }

  async findById(id: string): Promise<IDevice | null> {
    return await Device.findById(id).exec();
  }

  async findByDeviceId(deviceId: string): Promise<IDevice | null> {
    return await Device.findOne({ deviceId }).exec();
  }

  async findAll(
    filter: any = {},
    options: {
      skip?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<IDevice[]> {
    const query = Device.find(filter);

    if (options.skip) query.skip(options.skip);
    if (options.limit) query.limit(options.limit);
    if (options.sort) query.sort(options.sort);

    return await query.exec();
  }

  async update(
    id: string,
    updateData: Partial<IDevice>,
    options: { new?: boolean } = { new: true },
  ): Promise<IDevice | null> {
    return await Device.findByIdAndUpdate(id, updateData, options).exec();
  }

  async delete(id: string): Promise<IDevice | null> {
    return await Device.findByIdAndDelete(id).exec();
  }

  async updateParameters(
    deviceId: string,
    parameters: Record<string, any>,
  ): Promise<IDevice | null> {
    const device = await Device.findOne({ deviceId }).exec();
    if (!device) return null;

    Object.entries(parameters).forEach(([key, value]) => {
      device.parameters.set(key, value);
    });

    return await device.save();
  }

  async countOnlineDevices(): Promise<number> {
    return await Device.countDocuments({ status: 'online' }).exec();
  }

  async updateLastSeen(deviceId: string): Promise<IDevice | null> {
    return await Device.findOneAndUpdate(
      { deviceId },
      { lastSeen: new Date() },
      { new: true },
    ).exec();
  }

  async createMany(devices: Partial<IDevice>[]): Promise<IDevice[]> {
    const createdDevices = await Device.insertMany(devices);
    return createdDevices as IDevice[];
  }

  async findByStatus(
    status: IDevice['status'],
    options: {
      skip?: number;
      limit?: number;
    } = {},
  ): Promise<IDevice[]> {
    const query = Device.find({ status });

    if (options.skip) query.skip(options.skip);
    if (options.limit) query.limit(options.limit);

    return await query.exec();
  }

  async count(filter: any = {}): Promise<number> {
    return await Device.countDocuments(filter).exec();
  }

  async search(
    keyword: string,
    options: {
      skip?: number;
      limit?: number;
    } = {},
  ): Promise<IDevice[]> {
    const query = Device.find({
      $or: [
        { deviceId: { $regex: keyword, $options: 'i' } },
        { manufacturer: { $regex: keyword, $options: 'i' } },
        { model: { $regex: keyword, $options: 'i' } },
      ],
    });

    if (options.skip) query.skip(options.skip);
    if (options.limit) query.limit(options.limit);

    return await query.exec();
  }
}

export const deviceRepository = new DeviceRepository();
