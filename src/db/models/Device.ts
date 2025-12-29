import { model } from 'mongoose';
import { DeviceSchema, IDeviceDocument } from '../schemas/DeviceSchema';

export interface IDevice extends Omit<IDeviceDocument, '__v' | '_id'> {
  _id: string;
}

export const Device = model<IDeviceDocument>('Device', DeviceSchema);
