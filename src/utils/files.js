import { createWriteStream, existsSync, statSync } from 'fs';
import { basename, resolve } from 'path';

function sanitizeFallbackName(name) {
  const safeName = basename(name || '').trim();
  if (!safeName || safeName === '.' || safeName === '..') {
    throw new Error('Unable to derive a safe local filename');
  }
  return safeName;
}

export function resolveOutputPath(localPath, fallbackName) {
  if (!localPath) {
    return sanitizeFallbackName(fallbackName);
  }

  const resolvedPath = resolve(localPath);

  if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
    return resolve(resolvedPath, sanitizeFallbackName(fallbackName));
  }

  return resolvedPath;
}

export function createSafeWriteStream(targetPath, { force = false } = {}) {
  return createWriteStream(targetPath, { flags: force ? 'w' : 'wx' });
}

export function assertSafeToWrite(targetPath, { force = false } = {}) {
  if (!force && existsSync(targetPath)) {
    throw new Error(`Refusing to overwrite existing file: ${targetPath}. Use --force to overwrite.`);
  }
}
