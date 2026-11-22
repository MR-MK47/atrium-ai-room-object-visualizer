import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { tempAssetStore } from './storage.ts';

export interface FluxGenerationResult {
  dataUri: string;
  assetUrl: string;
  jobId: string;
  prompt: string;
}

export interface FluxMultiImageParams {
  backgroundBuffer: Buffer;
  backgroundMime: string;
  objectBuffer: Buffer;
  objectMime: string;
  prompt: string;
  width: number;
  height: number;
  seed: number;
  model?: string;
}

export interface FluxMultiImageResult {
  imageBytes: Buffer;
  mimeType: 'image/jpeg';
}

export class CloudflareAiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly hint?: string;

  constructor(
    code: string,
    message: string,
    status = 500,
    retryable = true,
    hint?: string
  ) {
    super(message);
    this.name = 'CloudflareAiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.hint = hint;
  }
}

export function getDefaultMultiImageModel(): string {
  dotenv.config({ override: true });
  return (
    process.env.CF_IMAGE_MODEL?.trim() ||
    process.env.CLOUDFLARE_IMAGE_MODEL?.trim() ||
    process.env.AI_MODEL?.trim() ||
    process.env.IMAGE_MODEL?.trim() ||
    process.env.MODEL?.trim() ||
    '@cf/black-forest-labs/flux-2-klein-4b'
  );
}

export function getCloudflareCredentials(): { accountId: string; apiToken: string } {
  dotenv.config({ override: true });
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new CloudflareAiError(
      'CLOUDFLARE_CREDENTIALS_MISSING',
      'Cloudflare Workers AI credentials are not configured on the server.',
      500,
      false,
      'Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your .env file.'
    );
  }

  return { accountId, apiToken };
}

/**
 * Direct Multi-Image Editing via Cloudflare Workers AI with FLUX.2 [klein] 4B.
 * Uses exact multipart/form-data schema with input_image_0 (room) and input_image_1 (object).
 */
export async function generateFluxMultiImageComposite(
  params: FluxMultiImageParams
): Promise<FluxMultiImageResult> {
  const { accountId, apiToken } = getCloudflareCredentials();
  const model = params.model?.trim() || getDefaultMultiImageModel();

  // Endpoint without Cloudflare AI Gateway
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  // Build a fresh FormData instance for this call
  const form = new FormData();
  form.append(
    'input_image_0',
    new Blob([new Uint8Array(params.backgroundBuffer)], { type: params.backgroundMime || 'image/jpeg' }),
    'room.jpg'
  );
  form.append(
    'input_image_1',
    new Blob([new Uint8Array(params.objectBuffer)], { type: params.objectMime || 'image/jpeg' }),
    'object.jpg'
  );
  form.append('prompt', params.prompt);
  form.append('width', String(params.width));
  form.append('height', String(params.height));
  form.append('seed', String(params.seed));
  // Note: flux-2-klein-4b uses fixed 4-step distilled inference; do NOT pass 'steps' parameter.

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'User-Agent': 'Atrium-AI-Visualizer',
      // Note: Do NOT manually set Content-Type so fetch appends boundary automatically
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Cloudflare Workers AI returned HTTP ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors?.[0]?.message) {
        message = errorJson.errors[0].message;
      }
    } catch {
      // fallback
    }

    if (response.status === 401 || response.status === 403) {
      throw new CloudflareAiError(
        'CLOUDFLARE_AUTH_FAILED',
        `Cloudflare authentication failed: ${message}`,
        response.status,
        false,
        'Verify that CLOUDFLARE_API_TOKEN has Workers AI "Run" permissions in Cloudflare Dashboard.'
      );
    }

    if (response.status === 429) {
      throw new CloudflareAiError(
        'CLOUDFLARE_RATE_LIMIT',
        'Cloudflare Workers AI rate limit reached. Please wait a moment and try again.',
        429,
        true
      );
    }

    throw new CloudflareAiError(
      'CLOUDFLARE_API_ERROR',
      message,
      response.status >= 500 ? 502 : response.status,
      response.status >= 500
    );
  }

  const data = (await response.json()) as {
    result?: { image?: string };
    image?: string;
    success?: boolean;
    errors?: Array<{ message: string }>;
  };

  const base64Image = data.result?.image || data.image;
  if (!base64Image) {
    throw new CloudflareAiError(
      'IMAGE_PAYLOAD_MISSING',
      'Cloudflare Workers AI completed successfully but returned no image data.',
      502,
      true
    );
  }

  return {
    imageBytes: Buffer.from(base64Image, 'base64'),
    mimeType: 'image/jpeg',
  };
}

/**
 * Text-to-image generator using Flux-1 Schnell for the quick object synthesis helper.
 */
export async function generateFluxImage(
  prompt: string,
  retentionHours = 24,
  overrideModel?: string
): Promise<FluxGenerationResult> {
  const { accountId, apiToken } = getCloudflareCredentials();

  const sanitizedPrompt = prompt.trim().slice(0, 2000);
  if (!sanitizedPrompt) {
    throw new CloudflareAiError(
      'INVALID_PROMPT',
      'Please provide a text prompt to generate an image.',
      400,
      false
    );
  }

  const model =
    overrideModel ||
    process.env.CF_TEXT_MODEL?.trim() ||
    '@cf/black-forest-labs/flux-1-schnell';

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Atrium-AI-Visualizer',
    },
    body: JSON.stringify({ prompt: sanitizedPrompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Cloudflare Workers AI returned HTTP ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors?.[0]?.message) {
        message = errorJson.errors[0].message;
      }
    } catch {
      // fallback
    }

    if (response.status === 401 || response.status === 403) {
      throw new CloudflareAiError(
        'CLOUDFLARE_AUTH_FAILED',
        `Cloudflare authentication failed: ${message}`,
        response.status,
        false,
        'Verify that CLOUDFLARE_API_TOKEN has Workers AI "Run" permissions in Cloudflare Dashboard.'
      );
    }

    if (response.status === 429) {
      throw new CloudflareAiError(
        'CLOUDFLARE_RATE_LIMIT',
        'Cloudflare Workers AI rate limit reached. Please wait a moment and try again.',
        429,
        true
      );
    }

    throw new CloudflareAiError(
      'CLOUDFLARE_API_ERROR',
      message,
      response.status >= 500 ? 502 : response.status,
      response.status >= 500
    );
  }

  const data = (await response.json()) as {
    result?: { image?: string };
    image?: string;
    success?: boolean;
    errors?: Array<{ message: string }>;
  };

  const base64Image = data.result?.image || data.image;
  if (!base64Image) {
    throw new CloudflareAiError(
      'IMAGE_PAYLOAD_MISSING',
      'Cloudflare Workers AI completed successfully but returned no image data.',
      502,
      true
    );
  }

  const dataUri = `data:image/jpeg;base64,${base64Image}`;
  const jobId = crypto.randomUUID();
  const filename = 'flux-object.jpg';
  const imageBuffer = Buffer.from(base64Image, 'base64');
  tempAssetStore.put(jobId, filename, imageBuffer, 'image/jpeg', retentionHours);
  const assetUrl = `/api/assets/${jobId}/${filename}`;

  return {
    dataUri,
    assetUrl,
    jobId,
    prompt: sanitizedPrompt,
  };
}
