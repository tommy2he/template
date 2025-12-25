import compress, { CompressOptions } from 'koa-compress';
import zlib from 'zlib';
import config from '../config';

export default function compression() {
  const options: CompressOptions = {
    filter: (contentType: string) => {
      return /text|javascript|json|css|svg\+xml/i.test(contentType);
    },
    threshold: 1024,
    gzip: {
      flush: zlib.constants.Z_SYNC_FLUSH,
    },
    deflate: {
      flush: zlib.constants.Z_SYNC_FLUSH,
    },
  };

  // TypeScript 友好：明确处理 brotli 配置
  if (config.env === 'production') {
    (options as any).br = {};
  }

  return compress(options);
}
