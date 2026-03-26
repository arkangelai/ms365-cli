import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeToWrite, resolveOutputPath } from '../../src/utils/files.js';

let testDir = null;

afterEach(() => {
  if (testDir) {
    rmSync(testDir, { recursive: true, force: true });
    testDir = null;
  }
});

describe('file safety utils', () => {
  it('refuses to overwrite an existing file unless forced', () => {
    testDir = mkdtempSync(join(tmpdir(), 'ms365-cli-'));
    const filePath = join(testDir, 'report.txt');
    writeFileSync(filePath, 'existing');

    expect(() => assertSafeToWrite(filePath)).toThrow('Refusing to overwrite existing file');
    expect(() => assertSafeToWrite(filePath, { force: true })).not.toThrow();
  });

  it('uses the fallback name when target is a directory', () => {
    testDir = mkdtempSync(join(tmpdir(), 'ms365-cli-'));
    const downloadsDir = join(testDir, 'downloads');
    mkdirSync(downloadsDir);

    expect(resolveOutputPath(downloadsDir, 'mail.txt')).toBe(join(downloadsDir, 'mail.txt'));
  });

  it('sanitizes fallback names to a basename', () => {
    expect(resolveOutputPath(null, '../secret.txt')).toBe('secret.txt');
  });
});
