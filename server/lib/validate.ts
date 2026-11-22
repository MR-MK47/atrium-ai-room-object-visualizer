import fs from 'node:fs';
import path from 'node:path';
import { PRESET_CATALOG } from '../../src/lib/presets.ts';

export type SupportedServerImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VARIATION_FILENAME_PATTERN = /^(variation-[1-3]|flux-object|[a-zA-Z0-9_-]+)\.(png|jpg|jpeg|webp)$/;

const PRESET_ALLOWLIST = new Map(PRESET_CATALOG.map((preset) => [preset.id, preset]));

/**
 * Verifies real binary image signature via magic bytes (ignores spoofed Content-Type or filename).
 */
export function detectImageMimeFromMagicBytes(buffer: Buffer): SupportedServerImageMime | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF" .... "WEBP"
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

export function sanitizeInstructions(raw: unknown): { value: string; error?: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: '' };
  }
  if (typeof raw !== 'string') {
    return { value: '', error: 'Placement instructions must be plain text.' };
  }

  // Strip ASCII control characters except newlines/tabs, then normalize whitespace
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 300) {
    return {
      value: '',
      error: 'Placement instructions must be 300 characters or fewer.',
    };
  }

  return { value: cleaned };
}

export function parseVariationCount(raw: unknown): 1 | 2 | 3 {
  const n = Number(raw);
  if (n === 1) return 1;
  if (n === 3) return 3;
  return 2;
}

export function isValidJobId(jobId: string): boolean {
  return UUID_V4_PATTERN.test(jobId);
}

export function isValidVariationFilename(filename: string): boolean {
  return VARIATION_FILENAME_PATTERN.test(filename);
}

/**
 * Loads an allowlisted preset image from disk with strict directory confinement.
 */
export function loadAllowlistedPresetImage(presetId: string): {
  buffer: Buffer;
  mimeType: SupportedServerImageMime;
  presetName: string;
} | null {
  const preset = PRESET_ALLOWLIST.get(presetId);
  if (!preset) return null;

  const fileName = path.basename(preset.imageUrl);
  const candidateBaseDirs = [
    path.resolve(process.cwd(), 'src', 'assets', 'images'),
    path.resolve(process.cwd(), 'dist', 'src', 'assets', 'images'),
  ];

  for (const baseDir of candidateBaseDirs) {
    const resolvedPath = path.resolve(baseDir, fileName);
    if (!resolvedPath.startsWith(baseDir + path.sep)) {
      continue;
    }
    if (fs.existsSync(resolvedPath)) {
      const buffer = fs.readFileSync(resolvedPath);
      const mimeType = detectImageMimeFromMagicBytes(buffer);
      if (mimeType) {
        return { buffer, mimeType, presetName: preset.name };
      }
    }
  }

  return null;
}
