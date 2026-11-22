import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  generateFluxMultiImageComposite,
  CloudflareAiError,
  getDefaultMultiImageModel,
} from './cloudflare-ai.ts';
import type {
  AspectRatioMode,
  ImageModelId,
  OutputResolution,
} from '../../src/types/visualizer.ts';
import {
  buildDirectMultiImagePrompt,
  calculateTargetDimensions,
  type SupportedGeminiAspectRatio,
} from './prompt-builder.ts';

export interface CompositeRequest {
  backgroundBytes: Buffer;
  backgroundMime: string;
  backgroundWidth?: number;
  backgroundHeight?: number;
  objectBytes: Buffer;
  objectMime: string;
  objectLabel?: string;
  userInstructions?: string;
  variationIndex: number;
  totalVariations: number;
  model: ImageModelId;
  aspectRatio: SupportedGeminiAspectRatio;
  aspectRatioMode: AspectRatioMode;
  resolution: OutputResolution;
}

export interface CompositeResult {
  imageBytes: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export class ProviderError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly hint?: string;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    retryable: boolean,
    hint?: string
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.hint = hint;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new ProviderError(
      'API_KEY_MISSING',
      'Gemini API key is not configured on the server.',
      500,
      false,
      'Configure GEMINI_API_KEY in your .env file to enable live AI image composition.'
    );
  }

  process.env.GOOGLE_API_KEY = apiKey;

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown, model: ImageModelId): ProviderError {
  if (err instanceof ProviderError) return err;

  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown AI error');
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('403')
  ) {
    return new ProviderError(
      'API_KEY_INVALID',
      'Your Gemini API key was rejected or lacks access to this image model.',
      403,
      false,
      'Check your API key in the Settings > Secrets panel.'
    );
  }

  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return new ProviderError(
      'QUOTA_EXCEEDED',
      `The ${model} image model returned a quota or billing limit error.`,
      429,
      true,
      'Upgrading to a billing-enabled API key in Settings > Secrets unlocks full quota.'
    );
  }

  if (
    lower.includes('safety') ||
    lower.includes('blocked') ||
    lower.includes('prohibited') ||
    lower.includes('policy')
  ) {
    return new ProviderError(
      'CONTENT_BLOCKED',
      "The AI couldn't process one of these images due to safety guidelines. Try a different photo or rephrase your instructions.",
      422,
      false
    );
  }

  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('deadline')) {
    return new ProviderError(
      'TIMEOUT',
      'Generation took longer than expected. Please try again.',
      504,
      true
    );
  }

  if (lower.includes('not_found') || lower.includes('404')) {
    return new ProviderError(
      'MODEL_UNAVAILABLE',
      `Image model "${model}" is unavailable for the current API key.`,
      502,
      true,
      'Open Settings to switch between available models.'
    );
  }

  return new ProviderError(
    'UPSTREAM_ERROR',
    "Couldn't reach the image generator right now. Please try again in a moment.",
    502,
    true
  );
}

export function getActiveProvider(): 'gemini' | 'cloudflare' | 'openai' {
  dotenv.config({ override: true });
  const envProvider = (
    process.env.AI_PROVIDER ||
    process.env.IMAGE_PROVIDER ||
    process.env.PROVIDER ||
    'cloudflare'
  ).toLowerCase().trim();

  if (envProvider === 'cloudflare' || envProvider === 'cf') return 'cloudflare';
  if (envProvider === 'openai') return 'openai';
  if (envProvider === 'gemini') return 'gemini';

  return 'cloudflare';
}

/**
 * Executes a single image composition variation.
 * Uses direct multi-image editing with Cloudflare Workers AI FLUX.2 [klein] 4B by default.
 */
export async function generateSingleComposite(req: CompositeRequest): Promise<CompositeResult> {
  const activeProvider = getActiveProvider();
  const isCloudflareModel = req.model.startsWith('@cf/') || !req.model.startsWith('gemini');

  // Direct multi-image editing with Cloudflare Workers AI
  if (activeProvider === 'cloudflare' || isCloudflareModel) {
    const model = req.model.startsWith('@cf/') ? req.model : getDefaultMultiImageModel();

    // 1. Calculate dimensions preserving original room aspect ratio
    const { width, height } = calculateTargetDimensions({
      backgroundWidth: req.backgroundWidth,
      backgroundHeight: req.backgroundHeight,
      maxDimension: 1024,
    });

    // 2. Strict edit-in-place prompt referencing image 0 (room) and image 1 (object)
    const prompt = buildDirectMultiImagePrompt({
      userInstructions: req.userInstructions,
      variationIndex: req.variationIndex,
    });

    // 3. Different random integer seed per variation
    const seed = Math.floor(Math.random() * 2147483647);

    try {
      const result = await generateFluxMultiImageComposite({
        backgroundBuffer: req.backgroundBytes,
        backgroundMime: req.backgroundMime,
        objectBuffer: req.objectBytes,
        objectMime: req.objectMime,
        prompt,
        width,
        height,
        seed,
        model,
      });

      return {
        imageBytes: result.imageBytes,
        mimeType: result.mimeType,
      };
    } catch (err) {
      if (err instanceof CloudflareAiError) {
        throw new ProviderError(
          err.code,
          err.message,
          err.status,
          err.retryable,
          err.hint
        );
      }
      throw new ProviderError(
        'CLOUDFLARE_AI_ERROR',
        err instanceof Error ? err.message : 'Failed to generate composite image with Workers AI.',
        502,
        true
      );
    }
  }

  // Fallback Gemini direct multi-image editing
  const ai = getGeminiClient();

  const prompt = buildDirectMultiImagePrompt({
    userInstructions: req.userInstructions,
    variationIndex: req.variationIndex,
  });

  const imageConfig: { aspectRatio: string; imageSize?: string } = {
    aspectRatio: req.aspectRatio,
  };

  const envGeminiModel = (
    process.env.AI_MODEL ||
    process.env.IMAGE_MODEL ||
    process.env.MODEL ||
    process.env.GEMINI_IMAGE_MODEL
  )?.trim();

  const effectiveModel =
    req.model && !req.model.startsWith('@cf/')
      ? req.model
      : (envGeminiModel || 'gemini-nano-banana-2.1');

  if (effectiveModel === 'gemini-nano-banana-2.1') {
    imageConfig.imageSize = req.resolution;
  }

  try {
    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: {
        parts: [
          // Part 1: LOCKED BASE CANVAS (Image 1 - The Room)
          {
            inlineData: {
              mimeType: req.backgroundMime,
              data: req.backgroundBytes.toString('base64'),
            },
          },
          // Part 2: TARGET REFERENCE OBJECT (Image 2 - The Object to Insert)
          {
            inlineData: {
              mimeType: req.objectMime,
              data: req.objectBytes.toString('base64'),
            },
          },
          // Part 3: STRICT EDIT-IN-PLACE COMPOSITION DIRECTIVE
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: ['IMAGE'],
        imageConfig,
      },
    });

    const candidate = response.candidates?.[0];
    if (
      candidate?.finishReason &&
      ['SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY', 'BLOCKLIST'].includes(
        String(candidate.finishReason)
      )
    ) {
      throw new ProviderError(
        'CONTENT_BLOCKED',
        "The AI couldn't process one of these images due to safety guidelines. Try a different photo or rephrase your instructions.",
        422,
        false
      );
    }

    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const rawMime = part.inlineData.mimeType || 'image/png';
        const mimeType: CompositeResult['mimeType'] =
          rawMime === 'image/jpeg' || rawMime === 'image/webp' ? rawMime : 'image/png';
        return {
          imageBytes: Buffer.from(part.inlineData.data, 'base64'),
          mimeType,
        };
      }
    }

    throw new ProviderError(
      'AI_GENERATION_FAILED',
      "We couldn't generate a composite image for this combination. Try a clearer photo or adjust your placement instructions.",
      502,
      true
    );
  } catch (err) {
    throw classifyGeminiError(err, req.model);
  }
}
