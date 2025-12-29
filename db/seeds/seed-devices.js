// 设备种子数据
const devices = [
  {
    deviceId: 'device-001',
    manufacturer: 'Cisco',
    model: 'C9300-24P',
    firmwareVersion: '17.03.04',
    ipAddress: '192.168.1.100',
    status: 'online',
    lastSeen: new Date(),
    parameters: {
      location: 'Data Center A',
      department: 'IT',
      contact: 'admin@example.com',
    },
    tags: ['switch', 'core', 'cisco'],
    metadata: {
      purchasedDate: new Date('2023-01-15'),
      warrantyUntil: new Date('2026-01-15'),
      serialNumber: 'FOC1234ABCD',
    },
  },
  {
    deviceId: 'device-002',
    manufacturer: 'Huawei',
    model: 'S5735S-L24P4S-A',
    firmwareVersion: 'V200R019C10',
    ipAddress: '192.168.1.101',
    status: 'online',
    lastSeen: new Date(),
    parameters: {
      location: 'Office Building B',
      department: 'HR',
      contact: 'hr@example.com',
    },
    tags: ['switch', 'access', 'huawei'],
    metadata: {
      purchasedDate: new Date('2023-03-20'),
      warrantyUntil: new Date('2026-03-20'),
      serialNumber: '2102310ABCD1234',
    },
  },
  {
    deviceId: 'device-003',
    manufacturer: 'Ubiquiti',
    model: 'UniFi Switch 24',
    firmwareVersion: '6.5.55',
    ipAddress: '192.168.1.102',
    status: 'offline',
    lastSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
    parameters: {
      location: 'Remote Office C',
      department: 'Sales',
      contact: 'sales@example.com',
    },
    tags: ['switch', 'remote', 'ubiquiti'],
    metadata: {
      purchasedDate: new Date('2022-11-05'),
      warrantyUntil: new Date('2025-11-05'),
      serialNumber: 'UBNT123456789',
    },
  },
  {
    deviceId: 'device-004',
    manufacturer: 'MikroTik',
    model: 'CRS326-24G-2S+RM',
    firmwareVersion: '7.11.2',
    ipAddress: '192.168.1.103',
    status: 'maintenance',
    lastSeen: new Date(),
    parameters: {
      location: 'Lab Room D',
      department: 'R&D',
      contact: 'rd@example.com',
    },
    tags: ['switch', 'lab', 'mikrotik'],
    metadata: {
      purchasedDate: new Date('2023-05-10'),
      warrantyUntil: new Date('2026-05-10'),
      serialNumber: 'MIKRO12345',
    },
  },
  {
    deviceId: 'device-005',
    manufacturer: 'TP-Link',
    model: 'TL-SG1024DE',
    firmwareVersion: '1.0.0',
    ipAddress: '192.168.1.104',
    status: 'provisioning',
    lastSeen: new Date(),
    parameters: {
      location: 'Storage Room E',
      department: 'Logistics',
      contact: 'logistics@example.com',
    },
    tags: ['switch', 'storage', 'tplink'],
    metadata: {
      purchasedDate: new Date('2023-08-15'),
      warrantyUntil: new Date('2026-08-15'),
      serialNumber: 'TPLINK98765',
    },
  },
];

module.exports = devices;
