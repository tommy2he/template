/* eslint-disable no-console */
// cpe/src/cli-parser.ts - 命令行参数解析工具
export interface CLIArgs {
  mode: 1 | 2 | 3; // 运行模式
  port?: number; // UDP端口
  devid?: string; // 指定设备ID
  manufacturer?: string; // 指定厂商
  model?: string; // 指定型号
  count?: number; // 批量生成数量（模式2）
  startPort?: number; // 起始端口（模式2）
}

// 厂商型号数据库
export const MANUFACTURER_DB = [
  {
    name: 'TP-Link',
    models: ['Archer C7', 'Archer A7', 'Archer AX10', 'TL-WR841N'],
  },
  { name: 'Huawei', models: ['HG8245', 'HG8247', 'HG8240', 'HG8010'] },
  { name: 'Cisco', models: ['ISR 4000', 'ASR 1000', 'Catalyst 9200', 'RV340'] },
  { name: 'ZTE', models: ['F670', 'F601', 'F660', 'F652'] },
  { name: 'Fiberhome', models: ['HG6543', 'HG261', 'AN5506', 'AN5506-04'] },
  { name: 'Netgear', models: ['R7000', 'R8000', 'Orbi RBR50', 'Nighthawk X6'] },
  {
    name: 'Xiaomi',
    models: ['Mi Router 4', 'Mi Router 3G', 'Mi Router AX3600'],
  },
  { name: 'D-Link', models: ['DIR-878', 'DIR-882', 'COVR-1100'] },
];

// 解析命令行参数
export function parseCLIArgs(): CLIArgs {
  const args: CLIArgs = {
    mode: 1, // 默认模式1
  };

  const rawArgs = process.argv.slice(2);

  rawArgs.forEach((arg) => {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');
      const cleanKey = key.replace(/^--?/, '').toLowerCase();

      switch (cleanKey) {
        case 'mode': {
          const modeNum = parseInt(value);
          if ([1, 2, 3].includes(modeNum)) {
            args.mode = modeNum as 1 | 2 | 3;
          } else {
            console.warn(`⚠️  无效的模式: ${value}，使用默认模式1`);
          }
          break;
        }

        case 'port': {
          const portNum = parseInt(value);
          if (portNum >= 1024 && portNum <= 65535) {
            args.port = portNum;
          } else {
            console.warn(`⚠️  无效的端口: ${value}，使用默认端口`);
          }
          break;
        }

        case 'devid':
        case 'deviceid':
          args.devid = value;
          break;

        case 'manufacturer':
          args.manufacturer = value;
          break;

        case 'model':
          args.model = value;
          break;

        case 'count': {
          const countNum = parseInt(value);
          if (countNum > 0 && countNum <= 100) {
            args.count = countNum;
          }
          break;
        }

        case 'startport': {
          const startPort = parseInt(value);
          if (startPort >= 1024 && startPort <= 65535) {
            args.startPort = startPort;
          }
          break;
        }
      }
    }
  });

  // 打印解析结果
  console.log('🔧 命令行参数解析结果:');
  console.log(`   模式: ${args.mode}`);
  if (args.port) console.log(`   端口: ${args.port}`);
  if (args.devid) console.log(`   设备ID: ${args.devid}`);
  if (args.manufacturer) console.log(`   厂商: ${args.manufacturer}`);
  if (args.model) console.log(`   型号: ${args.model}`);
  if (args.count) console.log(`   数量: ${args.count}`);
  if (args.startPort) console.log(`   起始端口: ${args.startPort}`);

  return args;
}

// 生成CPE ID
export function generateCPEId(port: number, timestamp?: Date): string {
  const now = timestamp || new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const pid = process.pid.toString().slice(-4);

  return `cpe-${port}-${month}${day}${hours}${minutes}${seconds}-${pid}`;
}

// 获取随机厂商和型号
export function getRandomManufacturer(): {
  manufacturer: string;
  model: string;
} {
  const manufacturer =
    MANUFACTURER_DB[Math.floor(Math.random() * MANUFACTURER_DB.length)];
  const model =
    manufacturer.models[Math.floor(Math.random() * manufacturer.models.length)];
  return { manufacturer: manufacturer.name, model };
}

// 根据模式生成CPE配置
export function generateCPEConfig(args: CLIArgs) {
  const basePort = args.port || parseInt(process.env.CPE_UDP_PORT || '7548');

  // 生成CPE ID
  let cpeId: string;
  let deviceId: string;

  if (args.mode === 3 && args.devid) {
    // 模式3：使用指定的设备ID
    cpeId = args.devid;
    deviceId = `dev-${args.devid}`;
  } else if (args.mode === 2) {
    // 模式2：自动生成
    cpeId = generateCPEId(basePort);
    deviceId = `dev-${cpeId}`;
  } else {
    // 模式1：使用环境变量或默认值
    cpeId = process.env.CPE_ID || 'cpe-001';
    deviceId = process.env.CPE_DEVICE_ID || 'dev-cpe-001';
  }

  // 选择厂商和型号
  let manufacturer: string;
  let model: string;

  if (args.manufacturer && args.model) {
    // 使用指定的厂商和型号
    manufacturer = args.manufacturer;
    model = args.model;
  } else if (args.mode === 2) {
    // 模式2：随机选择
    const randomManu = getRandomManufacturer();
    manufacturer = randomManu.manufacturer;
    model = randomManu.model;
  } else {
    // 模式1或3：使用环境变量或默认值
    manufacturer = process.env.CPE_MANUFACTURER || 'TP-Link';
    model = process.env.CPE_MODEL || 'Archer C7';
  }

  return {
    cpeId,
    deviceId,
    manufacturer,
    model,
    cpeUdpPort: basePort,
    cpeIp: process.env.CPE_IP || '127.0.0.1',
  };
}
