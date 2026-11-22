export type AppStatus = 'idle' | 'optimizing' | 'generating' | 'success' | 'error';

export type AIProviderId = 'gemini' | 'cloudflare' | 'openai';

export type ObjectInputMode = 'upload' | 'preset' | 'flux';

export type VariationCount = 1 | 2 | 3;

export type AspectRatioMode = 'match' | 'standard';

export type OutputResolution = '1K' | '2K' | '4K';

export type ImageModelId =
  | '@cf/black-forest-labs/flux-2-klein-4b'
  | '@cf/black-forest-labs/flux-1-schnell'
  | 'gemini-nano-banana-2.1'
  | 'gemini-3.1-flash-lite-image'
  | (string & {});

export interface PresetItem {
  id: string;
  name: string;
  category: 'Furniture' | 'Lighting' | 'Plants' | 'Wall Art' | 'Appliances' | 'Decor';
  description: string;
  thumbnailUrl: string;
  imageUrl: string;
}

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  originalName: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
  wasConvertedFromHeic: boolean;
  wasCompressed: boolean;
}

export interface VariationItem {
  index: number;
  imageUrl: string;
  downloadUrl: string;
  mimeType: string;
  aspectRatio: string;
  resolution: string;
  expiresAt: string;
}

export interface GenerationResponse {
  jobId: string;
  durationMs: number;
  requestedCount: number;
  model: ImageModelId;
  aspectRatio: string;
  aspectRatioMode: AspectRatioMode;
  resolution: OutputResolution;
  variations: VariationItem[];
  warnings: string[];
  usage?: UsageQuota;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    hint?: string;
  };
}

export interface AppSettings {
  provider: AIProviderId;
  aspectRatioMode: AspectRatioMode;
  standardAspectRatio: '4:3' | '16:9' | '3:4' | '1:1';
  resolution: OutputResolution;
  model: ImageModelId;
  dailyLimitEnabled: boolean;
  dailyLimitPerIp: number;
  botProtectionEnabled: boolean;
  retentionHours: number;
  maxUploadMb: number;
}

export interface UsageQuota {
  usedToday: number;
  limit: number;
  remaining: number;
  enforced: boolean;
  resetsAt: string;
}

export interface SettingsResponse {
  settings: AppSettings;
  usage: UsageQuota;
  hasApiKeyConfigured: boolean;
}
