import type {
  ApiErrorPayload,
  AppSettings,
  GenerationResponse,
  SettingsResponse,
  VariationCount,
} from '../types/visualizer';

const GENERATION_TIMEOUT_MS = 55_000;

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly hint?: string;

  constructor(code: string, message: string, status: number, retryable: boolean, hint?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.hint = hint;
  }
}

async function parseErrorResponse(res: Response): Promise<ApiClientError> {
  try {
    const data = (await res.json()) as Partial<ApiErrorPayload>;
    if (data.error?.message) {
      return new ApiClientError(
        data.error.code || 'API_ERROR',
        data.error.message,
        res.status,
        data.error.retryable ?? res.status >= 500,
        data.error.hint
      );
    }
  } catch {
    // Non-JSON error body
  }

  return new ApiClientError(
    'HTTP_ERROR',
    `Request failed with status ${res.status}. Please try again.`,
    res.status,
    res.status >= 500
  );
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as SettingsResponse;
}

export async function updateAppSettings(
  partial: Partial<AppSettings>
): Promise<SettingsResponse> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as SettingsResponse;
}

export async function resetAppSettings(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings/reset', { method: 'POST' });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as SettingsResponse;
}

export async function resetDailyUsageCounter(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings/reset-usage', { method: 'POST' });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as SettingsResponse;
}

export async function requestChallengeVerification(): Promise<{
  token: string;
  expiresAt: string;
}> {
  const res = await fetch('/api/challenge/verify', { method: 'POST' });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as { token: string; expiresAt: string };
}

export interface FluxImageResponse {
  success: boolean;
  imageUrl: string;
  assetUrl: string;
  jobId: string;
  prompt: string;
}

export async function generateFluxImage(prompt: string): Promise<FluxImageResponse> {
  const res = await fetch('/api/ai/generate-flux', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return (await res.json()) as FluxImageResponse;
}

export async function generateVariations(params: {
  backgroundFile: File;
  backgroundWidth: number;
  backgroundHeight: number;
  objectFile?: File | null;
  presetId?: string | null;
  variationCount: VariationCount;
  instructions: string;
  challengeToken?: string | null;
}): Promise<GenerationResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiClientError(
      'OFFLINE',
      'You appear to be offline. Check your internet connection and try again.',
      0,
      true
    );
  }

  const formData = new FormData();
  formData.append('background', params.backgroundFile);
  formData.append('backgroundWidth', String(params.backgroundWidth));
  formData.append('backgroundHeight', String(params.backgroundHeight));
  formData.append('variationCount', String(params.variationCount));
  formData.append('instructions', params.instructions.trim());

  if (params.objectFile) {
    formData.append('object', params.objectFile);
  } else if (params.presetId) {
    formData.append('presetId', params.presetId);
  }

  if (params.challengeToken) {
    formData.append('challengeToken', params.challengeToken);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw await parseErrorResponse(res);
    }

    return (await res.json()) as GenerationResponse;
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError(
        'TIMEOUT',
        'Generation took longer than expected. Please try again.',
        504,
        true
      );
    }
    throw new ApiClientError(
      'NETWORK_ERROR',
      "Couldn't reach the image generator right now. Please try again in a moment.",
      0,
      true
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function downloadVariationImage(
  downloadUrl: string,
  variationIndex: number
): Promise<void> {
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  const blob = await res.blob();
  const ext = blob.type.includes('jpeg')
    ? 'jpg'
    : blob.type.includes('webp')
      ? 'webp'
      : 'png';
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `atrium-variation-${variationIndex}.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
