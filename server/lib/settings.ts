import crypto from 'node:crypto';
import dotenv from 'dotenv';
import type {
  AIProviderId,
  AppSettings,
  AspectRatioMode,
  ImageModelId,
  OutputResolution,
} from '../../src/types/visualizer.ts';

const ALLOWED_PROVIDERS: readonly AIProviderId[] = ['gemini', 'cloudflare', 'openai'];

export function parseEnvProvider(): AIProviderId {
  dotenv.config({ override: true });
  const raw = (
    process.env.AI_PROVIDER ||
    process.env.IMAGE_PROVIDER ||
    process.env.PROVIDER ||
    'cloudflare'
  ).toLowerCase().trim();

  if (raw === 'cloudflare' || raw === 'cf') return 'cloudflare';
  if (raw === 'openai') return 'openai';
  if (raw === 'gemini') return 'gemini';
  return 'cloudflare';
}

const ALLOWED_MODELS: readonly ImageModelId[] = [
  '@cf/black-forest-labs/flux-2-klein-4b',
  '@cf/black-forest-labs/flux-1-schnell',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-lite-image',
];

const ALLOWED_RESOLUTIONS: readonly OutputResolution[] = ['1K', '2K', '4K'];
const ALLOWED_ASPECT_MODES: readonly AspectRatioMode[] = ['match', 'standard'];
const ALLOWED_STANDARD_RATIOS = ['4:3', '16:9', '3:4', '1:1'] as const;

let lastKnownEnvModel = '';

export function parseEnvModel(): ImageModelId {
  dotenv.config({ override: true });
  const raw = (
    process.env.CF_IMAGE_MODEL ||
    process.env.AI_MODEL ||
    process.env.IMAGE_MODEL ||
    process.env.MODEL ||
    process.env.CLOUDFLARE_IMAGE_MODEL ||
    (parseEnvProvider() === 'gemini' ? process.env.GEMINI_IMAGE_MODEL : '') ||
    ''
  ).trim();
  if (raw) {
    return raw as ImageModelId;
  }
  return '@cf/black-forest-labs/flux-2-klein-4b';
}

function parseEnvNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: parseEnvProvider(),
  aspectRatioMode: 'match',
  standardAspectRatio: '4:3',
  resolution: '2K',
  model: parseEnvModel(),
  dailyLimitEnabled: false,
  dailyLimitPerIp: 5,
  botProtectionEnabled: false,
  retentionHours: parseEnvNumber(process.env.ASSET_RETENTION_HOURS, 24, 1, 72),
  maxUploadMb: parseEnvNumber(process.env.MAX_UPLOAD_MB, 10, 1, 20),
};

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };

// Ephemeral in-memory HMAC key for lightweight human-verification tokens
const CHALLENGE_HMAC_SECRET = crypto.randomBytes(32);
const CHALLENGE_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getSettings(): AppSettings {
  currentSettings.provider = parseEnvProvider();
  const envModel = parseEnvModel();
  if (envModel !== lastKnownEnvModel) {
    lastKnownEnvModel = envModel;
    currentSettings.model = envModel;
  }
  return { ...currentSettings };
}

let userOverrodeModel = false;

export function resetSettingsToDefaults(): AppSettings {
  userOverrodeModel = false;
  currentSettings = { ...DEFAULT_SETTINGS, model: parseEnvModel() };
  return getSettings();
}

export function updateSettings(input: unknown): { settings?: AppSettings; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Settings payload must be a JSON object.' };
  }

  const body = input as Record<string, unknown>;
  const next: AppSettings = { ...currentSettings };

  if (body.provider !== undefined) {
    if (
      typeof body.provider !== 'string' ||
      !(ALLOWED_PROVIDERS as readonly string[]).includes(body.provider as AIProviderId)
    ) {
      return { error: 'Invalid provider selected. Must be "gemini" or "cloudflare".' };
    }
    next.provider = body.provider as AIProviderId;
  }

  if (body.aspectRatioMode !== undefined) {
    if (
      typeof body.aspectRatioMode !== 'string' ||
      !(ALLOWED_ASPECT_MODES as readonly string[]).includes(body.aspectRatioMode)
    ) {
      return { error: 'Invalid aspectRatioMode. Must be "match" or "standard".' };
    }
    next.aspectRatioMode = body.aspectRatioMode as AspectRatioMode;
  }

  if (body.standardAspectRatio !== undefined) {
    if (
      typeof body.standardAspectRatio !== 'string' ||
      !(ALLOWED_STANDARD_RATIOS as readonly string[]).includes(body.standardAspectRatio)
    ) {
      return { error: 'Invalid standardAspectRatio. Must be 4:3, 16:9, 3:4, or 1:1.' };
    }
    next.standardAspectRatio = body.standardAspectRatio as AppSettings['standardAspectRatio'];
  }

  if (body.resolution !== undefined) {
    if (
      typeof body.resolution !== 'string' ||
      !(ALLOWED_RESOLUTIONS as readonly string[]).includes(body.resolution)
    ) {
      return { error: 'Invalid resolution. Must be "1K", "2K", or "4K".' };
    }
    next.resolution = body.resolution as OutputResolution;
  }

  if (body.model !== undefined) {
    if (
      typeof body.model !== 'string' ||
      !body.model.trim() ||
      body.model.length > 100
    ) {
      return { error: 'Invalid model selected.' };
    }
    userOverrodeModel = true;
    next.model = body.model.trim() as ImageModelId;
  }

  if (body.dailyLimitEnabled !== undefined) {
    if (typeof body.dailyLimitEnabled !== 'boolean') {
      return { error: 'dailyLimitEnabled must be a boolean.' };
    }
    next.dailyLimitEnabled = body.dailyLimitEnabled;
  }

  if (body.dailyLimitPerIp !== undefined) {
    if (
      typeof body.dailyLimitPerIp !== 'number' ||
      !Number.isInteger(body.dailyLimitPerIp) ||
      body.dailyLimitPerIp < 1 ||
      body.dailyLimitPerIp > 100
    ) {
      return { error: 'dailyLimitPerIp must be an integer between 1 and 100.' };
    }
    next.dailyLimitPerIp = body.dailyLimitPerIp;
  }

  if (body.botProtectionEnabled !== undefined) {
    if (typeof body.botProtectionEnabled !== 'boolean') {
      return { error: 'botProtectionEnabled must be a boolean.' };
    }
    next.botProtectionEnabled = body.botProtectionEnabled;
  }

  if (body.retentionHours !== undefined) {
    if (
      typeof body.retentionHours !== 'number' ||
      !Number.isInteger(body.retentionHours) ||
      body.retentionHours < 1 ||
      body.retentionHours > 72
    ) {
      return { error: 'retentionHours must be an integer between 1 and 72.' };
    }
    next.retentionHours = body.retentionHours;
  }

  if (body.maxUploadMb !== undefined) {
    if (
      typeof body.maxUploadMb !== 'number' ||
      !Number.isInteger(body.maxUploadMb) ||
      body.maxUploadMb < 1 ||
      body.maxUploadMb > 20
    ) {
      return { error: 'maxUploadMb must be an integer between 1 and 20.' };
    }
    next.maxUploadMb = body.maxUploadMb;
  }

  currentSettings = next;
  return { settings: getSettings() };
}

export function issueChallengeToken(clientIp: string): { token: string; expiresAt: string } {
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${clientIp}|${issuedAt}|${nonce}`;
  const sig = crypto
    .createHmac('sha256', CHALLENGE_HMAC_SECRET)
    .update(payload)
    .digest('hex');
  const token = Buffer.from(`${payload}|${sig}`, 'utf8').toString('base64url');
  return {
    token,
    expiresAt: new Date(issuedAt + CHALLENGE_TOKEN_TTL_MS).toISOString(),
  };
}

export function verifyChallengeToken(token: string | undefined, clientIp: string): boolean {
  if (!token || typeof token !== 'string' || token.length > 512) {
    return false;
  }
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 4) return false;

    const [tokenIp, issuedAtStr, nonce, providedSig] = parts;
    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > CHALLENGE_TOKEN_TTL_MS) return false;
    if (tokenIp !== clientIp) return false;

    const expectedSig = crypto
      .createHmac('sha256', CHALLENGE_HMAC_SECRET)
      .update(`${tokenIp}|${issuedAtStr}|${nonce}`)
      .digest('hex');

    const providedBuf = Buffer.from(providedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}
