import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { PRESET_CATALOG } from '../src/lib/presets.ts';
import type { GenerationResponse, VariationItem } from '../src/types/visualizer.ts';
import { generateSingleComposite, ProviderError } from './lib/ai-provider.ts';
import { CloudflareAiError, generateFluxImage } from './lib/cloudflare-ai.ts';
import { resolveOutputAspectRatio } from './lib/prompt-builder.ts';
import {
  checkAndReserveQuota,
  getClientIdentifier,
  getUsageQuota,
  refundQuotaOnFailure,
  resetQuotaForClient,
} from './lib/rate-limit.ts';
import {
  getSettings,
  issueChallengeToken,
  resetSettingsToDefaults,
  updateSettings,
  verifyChallengeToken,
} from './lib/settings.ts';
import { tempAssetStore } from './lib/storage.ts';
import {
  detectImageMimeFromMagicBytes,
  isValidJobId,
  isValidVariationFilename,
  loadAllowlistedPresetImage,
  parseVariationCount,
  sanitizeInstructions,
} from './lib/validate.ts';

const HARD_UPLOAD_CEILING_BYTES = 20 * 1024 * 1024; // 20 MB upper guardrail

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: HARD_UPLOAD_CEILING_BYTES,
    files: 2,
    fields: 10,
  },
});

function hasConfiguredApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  hint?: string
): void {
  res.status(status).json({
    error: {
      code,
      message,
      retryable,
      ...(hint ? { hint } : {}),
    },
  });
}

/**
 * Creates and configures the Express API application with all endpoints.
 * Shared between standalone local server (server.ts) and serverless deployment (api/index.ts).
 */
export function createApiApp(): Express {
  if (process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Serve static assets directory for preset catalog images
  app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src', 'assets')));
  app.use('/public/src/assets', express.static(path.resolve(process.cwd(), 'public', 'src', 'assets')));

  // 1. Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasApiKeyConfigured: hasConfiguredApiKey(),
      activeTempAssets: tempAssetStore.count(),
    });
  });

  // 2. Preset catalog
  app.get('/api/presets', (_req, res) => {
    res.json({ presets: PRESET_CATALOG });
  });

  // 2.5 Cloudflare Workers AI Quick Generator helper
  app.post('/api/ai/generate-flux', async (req, res) => {
    try {
      const prompt = req.body?.prompt;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        sendApiError(res, 400, 'INVALID_PROMPT', 'Please provide a valid text prompt.', false);
        return;
      }

      const settings = getSettings();
      const result = await generateFluxImage(prompt, settings.retentionHours);
      res.json({
        success: true,
        imageUrl: result.dataUri,
        assetUrl: result.assetUrl,
        jobId: result.jobId,
        prompt: result.prompt,
      });
    } catch (err) {
      if (err instanceof CloudflareAiError) {
        sendApiError(res, err.status, err.code, err.message, err.retryable, err.hint);
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to generate image with Cloudflare Workers AI.';
      sendApiError(res, 502, 'CLOUDFLARE_AI_ERROR', message, true);
    }
  });

  // 3. Settings & guardrail status
  app.get('/api/settings', (req, res) => {
    const settings = getSettings();
    const clientId = getClientIdentifier(req);
    res.json({
      settings,
      usage: getUsageQuota(clientId, settings),
      hasApiKeyConfigured: hasConfiguredApiKey(),
    });
  });

  app.put('/api/settings', (req, res) => {
    const result = updateSettings(req.body);
    if (result.error || !result.settings) {
      sendApiError(res, 400, 'INVALID_SETTINGS', result.error || 'Invalid settings payload.', false);
      return;
    }

    const clientId = getClientIdentifier(req);
    res.json({
      settings: result.settings,
      usage: getUsageQuota(clientId, result.settings),
      hasApiKeyConfigured: hasConfiguredApiKey(),
    });
  });

  app.post('/api/settings/reset', (req, res) => {
    const settings = resetSettingsToDefaults();
    const clientId = getClientIdentifier(req);
    res.json({
      settings,
      usage: getUsageQuota(clientId, settings),
      hasApiKeyConfigured: hasConfiguredApiKey(),
    });
  });

  app.post('/api/settings/reset-usage', (req, res) => {
    const settings = getSettings();
    const clientId = getClientIdentifier(req);
    resetQuotaForClient(clientId);
    res.json({
      settings,
      usage: getUsageQuota(clientId, settings),
      hasApiKeyConfigured: hasConfiguredApiKey(),
    });
  });

  // 4. Bot-protection / human-verification challenge endpoint
  app.post('/api/challenge/verify', (req, res) => {
    const clientId = getClientIdentifier(req);
    const issued = issueChallengeToken(clientId);
    res.json(issued);
  });

  // 5. Parallel AI room & object direct multi-image composition endpoint
  app.post(
    '/api/generate',
    (req, res, next) => {
      upload.fields([
        { name: 'background', maxCount: 1 },
        { name: 'object', maxCount: 1 },
      ])(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            sendApiError(
              res,
              413,
              'FILE_TOO_LARGE',
              'Image exceeds the maximum allowed upload size. Please choose a smaller photo.',
              false
            );
            return;
          }
          sendApiError(res, 400, 'UPLOAD_ERROR', 'Could not parse uploaded files.', false);
          return;
        }
        if (err) {
          sendApiError(res, 400, 'UPLOAD_ERROR', 'Unexpected upload error.', false);
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const startedAt = Date.now();
      const settings = getSettings();
      const clientId = getClientIdentifier(req);

      // Optional Bot Protection check
      if (settings.botProtectionEnabled) {
        const challengeToken =
          typeof req.body?.challengeToken === 'string' ? req.body.challengeToken : undefined;
        if (!verifyChallengeToken(challengeToken, clientId)) {
          sendApiError(
            res,
            403,
            'VERIFICATION_REQUIRED',
            'Please complete the quick human verification check before generating.',
            true
          );
          return;
        }
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const backgroundFile = files?.background?.[0];
      const objectFile = files?.object?.[0];
      const presetId = typeof req.body?.presetId === 'string' ? req.body.presetId.trim() : '';

      if (!backgroundFile) {
        sendApiError(
          res,
          400,
          'MISSING_BACKGROUND',
          'Please upload a background room or scene image first.',
          false
        );
        return;
      }

      const maxBytes = settings.maxUploadMb * 1024 * 1024;
      if (backgroundFile.size > maxBytes) {
        sendApiError(
          res,
          413,
          'FILE_TOO_LARGE',
          `Background image must be ${settings.maxUploadMb}MB or smaller. You can adjust this limit in Settings.`,
          false
        );
        return;
      }

      const backgroundMime = detectImageMimeFromMagicBytes(backgroundFile.buffer);
      if (!backgroundMime) {
        sendApiError(
          res,
          400,
          'INVALID_FILE_TYPE',
          'Please upload a valid JPG, PNG, WEBP, or HEIC background image.',
          false
        );
        return;
      }

      // Resolve target object (custom uploaded file or allowlisted preset)
      let objectBytes: Buffer;
      let objectMime: string;
      let objectLabel: string | undefined;

      if (objectFile) {
        if (objectFile.size > maxBytes) {
          sendApiError(
            res,
            413,
            'FILE_TOO_LARGE',
            `Object image must be ${settings.maxUploadMb}MB or smaller. You can adjust this limit in Settings.`,
            false
          );
          return;
        }
        const detectedObjectMime = detectImageMimeFromMagicBytes(objectFile.buffer);
        if (!detectedObjectMime) {
          sendApiError(
            res,
            400,
            'INVALID_FILE_TYPE',
            'Please upload a valid JPG, PNG, WEBP, or HEIC object image.',
            false
          );
          return;
        }
        objectBytes = objectFile.buffer;
        objectMime = detectedObjectMime;
      } else if (presetId) {
        const presetAsset = loadAllowlistedPresetImage(presetId);
        if (!presetAsset) {
          sendApiError(
            res,
            400,
            'INVALID_PRESET',
            'The selected sample catalog item could not be found.',
            false
          );
          return;
        }
        objectBytes = presetAsset.buffer;
        objectMime = presetAsset.mimeType;
        objectLabel = presetAsset.presetName;
      } else {
        sendApiError(
          res,
          400,
          'MISSING_OBJECT',
          'Please upload an object photo or pick an item from the Sample Catalog.',
          false
        );
        return;
      }

      // Validate instructions
      const sanitizedInstructions = sanitizeInstructions(req.body?.instructions);
      if (sanitizedInstructions.error) {
        sendApiError(res, 400, 'INVALID_INSTRUCTIONS', sanitizedInstructions.error, false);
        return;
      }

      const variationCount = parseVariationCount(req.body?.variationCount);
      const backgroundWidth = Number(req.body?.backgroundWidth);
      const backgroundHeight = Number(req.body?.backgroundHeight);
      const aspectRatio = resolveOutputAspectRatio({
        mode: settings.aspectRatioMode,
        standardAspectRatio: settings.standardAspectRatio,
        backgroundWidth,
        backgroundHeight,
      });

      // Enforce daily limit guardrail if enabled
      const quotaResult = checkAndReserveQuota(clientId, settings);
      if (!quotaResult.allowed) {
        sendApiError(
          res,
          429,
          'RATE_LIMIT_EXCEEDED',
          `Daily limit reached (${settings.dailyLimitPerIp} generations/day). Adjust or disable the cap in Settings, or try again tomorrow.`,
          false
        );
        return;
      }

      // Run parallel AI variations directly with FLUX.2 [klein] 4B
      const settled = await Promise.allSettled(
        Array.from({ length: variationCount }, (_, idx) =>
          generateSingleComposite({
            backgroundBytes: backgroundFile.buffer,
            backgroundMime,
            backgroundWidth,
            backgroundHeight,
            objectBytes,
            objectMime,
            objectLabel,
            userInstructions: sanitizedInstructions.value,
            variationIndex: idx,
            totalVariations: variationCount,
            model: settings.model,
            aspectRatio,
            aspectRatioMode: settings.aspectRatioMode,
            resolution: settings.resolution,
          })
        )
      );

      const jobId = crypto.randomUUID();
      const variations: VariationItem[] = [];
      const failureReasons: ProviderError[] = [];

      settled.forEach((outcome, idx) => {
        if (outcome.status === 'fulfilled') {
          const ext =
            outcome.value.mimeType === 'image/jpeg'
              ? 'jpg'
              : outcome.value.mimeType === 'image/webp'
                ? 'webp'
                : 'png';
          const filename = `variation-${idx + 1}.${ext}`;
          const stored = tempAssetStore.put(
            jobId,
            filename,
            outcome.value.imageBytes,
            outcome.value.mimeType,
            settings.retentionHours
          );

          const dataUri = `data:${outcome.value.mimeType};base64,${outcome.value.imageBytes.toString('base64')}`;

          variations.push({
            index: idx + 1,
            imageUrl: dataUri,
            downloadUrl: dataUri,
            mimeType: outcome.value.mimeType,
            aspectRatio,
            resolution: settings.model === 'gemini-nano-banana-2.1' ? settings.resolution : '1K',
            expiresAt: new Date(stored.expiresAt).toISOString(),
          });
        } else {
          const reason =
            outcome.reason instanceof ProviderError
              ? outcome.reason
              : new ProviderError(
                  'AI_GENERATION_FAILED',
                  'Variation failed to generate.',
                  502,
                  true
                );
          failureReasons.push(reason);
        }
      });

      // If all variations failed, refund quota and return primary error
      if (variations.length === 0) {
        refundQuotaOnFailure(clientId);
        const primaryError = failureReasons[0];
        sendApiError(
          res,
          primaryError?.httpStatus || 502,
          primaryError?.code || 'AI_GENERATION_FAILED',
          primaryError?.message ||
            "We couldn't generate images for this combination. Try a clearer photo or adjust your placement instructions.",
          primaryError?.retryable ?? true,
          primaryError?.hint
        );
        return;
      }

      const warnings: string[] = [];
      const failedCount = variationCount - variations.length;
      if (failedCount > 0) {
        warnings.push(
          `Generated ${variations.length} of ${variationCount} variations. Click Regenerate to try again.`
        );
      }

      const payload: GenerationResponse = {
        jobId,
        durationMs: Date.now() - startedAt,
        requestedCount: variationCount,
        model: settings.model,
        aspectRatio,
        aspectRatioMode: settings.aspectRatioMode,
        resolution: settings.model === 'gemini-nano-banana-2.1' ? settings.resolution : '1K',
        variations,
        warnings,
        usage: getUsageQuota(clientId, settings),
      };

      res.status(200).json(payload);
    }
  );

  // 6. Temporary asset streaming & download endpoint
  app.get('/api/assets/:jobId/:filename', (req, res) => {
    const { jobId, filename } = req.params;

    if (!isValidJobId(jobId) || !isValidVariationFilename(filename)) {
      sendApiError(res, 400, 'INVALID_ASSET_PATH', 'Invalid asset identifier.', false);
      return;
    }

    const asset = tempAssetStore.get(jobId, filename);
    if (!asset) {
      sendApiError(
        res,
        404,
        'NOT_FOUND',
        'This temporary image has expired or could not be found. Click Regenerate to create new ones.',
        false
      );
      return;
    }

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="atrium-${filename}"`);
    }

    res.send(asset.buffer);
  });

  // Fallback JSON 404 for unknown API routes
  app.use('/api', (_req, res) => {
    sendApiError(res, 404, 'ROUTE_NOT_FOUND', 'API endpoint not found.', false);
  });

  // Global error safety net
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Atrium Server Error]', err);
    if (!res.headersSent) {
      sendApiError(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.', true);
    }
  });

  return app;
}
