// /routes/api/deviceRoutes.ts - 清理版
import Router from 'koa-router';
import DeviceController from '../controllers/deviceController';

const router = new Router();

// 设备列表
router.get('/', DeviceController.getDevices);

// 创建设备
router.post('/', DeviceController.createDevice);

// 搜索设备
router.get('/search', DeviceController.searchDevices);

// 设备统计
router.get('/stats', DeviceController.getDeviceStats);

// 单个设备操作
router.get('/:id', DeviceController.getDevice);
router.put('/:id', DeviceController.updateDevice);
router.delete('/:id', DeviceController.deleteDevice);

// 更新设备参数
router.patch('/:id/parameters', DeviceController.updateDeviceParameters);

export default router;
