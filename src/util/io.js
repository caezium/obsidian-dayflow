import fs from 'fs/promises';
import path from 'path';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeIfChanged(filePath, content) {
  await ensureDir(path.dirname(filePath));
  let existing = null;
  try {
    existing = await fs.readFile(filePath, 'utf8');
  } catch {
    /* no-op */
  }
  if (existing === content) return { written: false, path: filePath };
  await fs.writeFile(filePath, content, 'utf8');
  return { written: true, path: filePath, created: existing === null };
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readCreatedAt(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const m = content.match(/created_at:\s*['"]?([^'"\n]+)['"]?/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}
