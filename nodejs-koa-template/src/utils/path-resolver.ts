// 创建 src/utils/path-resolver.ts
import path from 'path';

export function getProjectRoot(): string {
  return process.cwd();
}

export function resolvePath(relativePath: string): string {
  return path.resolve(getProjectRoot(), relativePath);
}
