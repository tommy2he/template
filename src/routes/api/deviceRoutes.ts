import Router from 'koa-router';
import DeviceController from '../controllers/deviceController';

const router = new Router();

// 获取设备列表（支持分页、过滤、排序）
router.get('/', DeviceController.getDevices);

// 创建设备
router.post('/', DeviceController.createDevice);

// 搜索设备
router.get('/search', DeviceController.searchDevices);

// 获取设备统计信息
router.get('/stats', DeviceController.getDeviceStats);

// 获取单个设备
router.get('/:id', DeviceController.getDevice);

// 更新设备
router.put('/:id', DeviceController.updateDevice);

// 删除设备
router.delete('/:id', DeviceController.deleteDevice);

// 更新设备参数
router.patch('/:id/parameters', DeviceController.updateDeviceParameters);

export default router;
