import type { AspectRatioMode } from '../../src/types/visualizer.ts';

export type SupportedGeminiAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

const RATIO_TABLE: Array<{ label: SupportedGeminiAspectRatio; value: number }> = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

/**
 * Calculates output width and height matching the room's original aspect ratio.
 * Clamped to valid range 256–1920, keeping the longest edge around 1024px and
 * rounding to multiples of 16 (fallback 1024x768).
 */
export function calculateTargetDimensions(params: {
  backgroundWidth?: number;
  backgroundHeight?: number;
  maxDimension?: number;
}): { width: number; height: number } {
  const maxDim = params.maxDimension || 1024;
  const bgW = params.backgroundWidth;
  const bgH = params.backgroundHeight;

  if (
    !bgW ||
    !bgH ||
    !Number.isFinite(bgW) ||
    !Number.isFinite(bgH) ||
    bgW <= 0 ||
    bgH <= 0
  ) {
    return { width: 1024, height: 768 };
  }

  let targetW: number;
  let targetH: number;

  if (bgW >= bgH) {
    targetW = maxDim;
    targetH = Math.round((bgH / bgW) * maxDim);
  } else {
    targetH = maxDim;
    targetW = Math.round((bgW / bgH) * maxDim);
  }

  // Clamp to valid range 256–1920
  targetW = Math.max(256, Math.min(1920, targetW));
  targetH = Math.max(256, Math.min(1920, targetH));

  // Round to nearest multiple of 16
  targetW = Math.round(targetW / 16) * 16;
  targetH = Math.round(targetH / 16) * 16;

  // Final sanity clamp in case rounding pushed outside bounds
  targetW = Math.max(256, Math.min(1920, targetW));
  targetH = Math.max(256, Math.min(1920, targetH));

  return { width: targetW, height: targetH };
}

export function resolveOutputAspectRatio(params: {
  mode: AspectRatioMode;
  standardAspectRatio: '4:3' | '16:9' | '3:4' | '1:1';
  backgroundWidth?: number;
  backgroundHeight?: number;
}): SupportedGeminiAspectRatio {
  if (params.mode === 'standard') {
    return params.standardAspectRatio;
  }

  const { backgroundWidth, backgroundHeight } = params;
  if (
    !backgroundWidth ||
    !backgroundHeight ||
    !Number.isFinite(backgroundWidth) ||
    !Number.isFinite(backgroundHeight) ||
    backgroundWidth <= 0 ||
    backgroundHeight <= 0
  ) {
    return '4:3';
  }

  const actualRatio = backgroundWidth / backgroundHeight;
  let closest = RATIO_TABLE[0];
  let smallestDelta = Math.abs(Math.log(actualRatio / closest.value));

  for (const candidate of RATIO_TABLE.slice(1)) {
    const delta = Math.abs(Math.log(actualRatio / candidate.value));
    if (delta < smallestDelta) {
      smallestDelta = delta;
      closest = candidate;
    }
  }

  return closest.label;
}

export const VARIATION_CUES = [
  'Variation 1: Place the object in its primary natural focal position on the floor or surface.',
  'Variation 2: Keep the room from image 0 100% identical. Place the object in an alternate natural spot, subtly angled or rotated by 15-25 degrees for an alternative natural viewing angle.',
  'Variation 3: Keep the room from image 0 100% identical. Place the object with a slightly adjusted distance and orientation relative to existing walls and furniture.',
] as const;

/**
 * Strict "Edit-in-Place" prompt builder for direct multi-image editing with FLUX.2 [klein] 4B.
 * Explicitly locks image 0 as the base room photograph and extracts/inserts only the object from image 1.
 */
export function buildDirectMultiImagePrompt(params: {
  userInstructions?: string;
  variationIndex: number;
}): string {
  const baseInstruction =
    'Edit image 0 directly by placing the exact object from image 1 into the room in image 0. ' +
    'Keep the room from image 0 completely identical—preserve the exact walls, floor, ceiling, windows, camera angle, framing, colors, lighting, and all existing objects without redesigning or restyling the space. ' +
    'Extract only the object from image 1 (completely ignoring image 1\'s background) and preserve its exact shape, color, material, and details. ' +
    'Scale the object realistically to match the room\'s proportions, align it with the room\'s perspective, rest it firmly on the appropriate physical surface (floor, table, counter, or wall—never floating), match the room\'s ambient light and color temperature, and add natural soft contact shadows beneath it.';

  const instructionsText = params.userInstructions?.trim();
  const placementInstruction = instructionsText
    ? `Follow this placement instruction strictly inside image 0: "${instructionsText}".`
    : 'Place the object in the most natural, visually balanced open spot in image 0.';

  const cue = VARIATION_CUES[params.variationIndex % VARIATION_CUES.length];

  return `${baseInstruction} ${placementInstruction} ${cue}`;
}
