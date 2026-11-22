import imageCompression from 'browser-image-compression';
import { SAMPLE_ROOM_ASSET } from './presets';
import type { ProcessedImage } from '../types/visualizer';

const ACCEPTED_STANDARD_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ACCEPTED_HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const ACCEPTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

export const FILE_INPUT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

export class ImageValidationError extends Error {
  readonly code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'HEIC_CONVERSION_FAILED' | 'DECODE_FAILED';

  constructor(
    code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'HEIC_CONVERSION_FAILED' | 'DECODE_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
  }
}

function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function isHeicFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (ACCEPTED_HEIC_MIMES.has(mime)) return true;
  const ext = getFileExtension(file.name);
  return ext === 'heic' || ext === 'heif';
}

function isSupportedImageFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (ACCEPTED_STANDARD_MIMES.has(mime) || ACCEPTED_HEIC_MIMES.has(mime)) {
    return true;
  }
  const ext = getFileExtension(file.name);
  return ACCEPTED_EXTENSIONS.has(ext);
}

async function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ImageValidationError(
          'DECODE_FAILED',
          'Could not read this image file. Please try another photo.'
        )
      );
    };
    img.src = url;
  });
}

async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default;
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const outputBlob = Array.isArray(converted) ? converted[0] : converted;
    const baseName = file.name.replace(/\.(heic|heif)$/i, '') || 'photo';
    return new File([outputBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    throw new ImageValidationError(
      'HEIC_CONVERSION_FAILED',
      'Could not convert this HEIC image in your browser. Please export it as JPG or PNG and try again.'
    );
  }
}

export async function processUploadedImage(
  rawFile: File,
  options: {
    maxUploadMb: number;
    onProgressStage?: (stage: string) => void;
  }
): Promise<ProcessedImage> {
  if (!isSupportedImageFile(rawFile)) {
    throw new ImageValidationError(
      'INVALID_FILE_TYPE',
      'Please upload a JPG, PNG, WEBP, or HEIC image.'
    );
  }

  const maxBytes = options.maxUploadMb * 1024 * 1024;
  if (rawFile.size > maxBytes) {
    throw new ImageValidationError(
      'FILE_TOO_LARGE',
      `Image must be ${options.maxUploadMb}MB or smaller. Choose a smaller photo or increase the limit in Settings.`
    );
  }

  let workingFile = rawFile;
  let wasConvertedFromHeic = false;

  if (isHeicFile(rawFile)) {
    options.onProgressStage?.('Converting HEIC photo...');
    workingFile = await convertHeicToJpeg(rawFile);
    wasConvertedFromHeic = true;
  }

  options.onProgressStage?.('Optimizing resolution...');
  let finalFile = workingFile;
  let wasCompressed = false;

  try {
    const targetType =
      workingFile.type === 'image/png' && workingFile.size < 1.5 * 1024 * 1024
        ? 'image/png'
        : 'image/jpeg';

    const compressed = await imageCompression(workingFile, {
      maxSizeMB: 1.8,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: targetType,
      initialQuality: 0.88,
      preserveExif: false,
    });

    const cleanBase = workingFile.name.replace(/\.[^.]+$/, '') || 'image';
    const ext = targetType === 'image/png' ? 'png' : 'jpg';
    finalFile = new File([compressed], `${cleanBase}.${ext}`, {
      type: compressed.type || targetType,
      lastModified: Date.now(),
    });
    wasCompressed = finalFile.size < rawFile.size;
  } catch {
    // Safe fallback to workingFile (already <= maxUploadMb and converted if HEIC)
    finalFile = workingFile;
    wasCompressed = false;
  }

  const { width, height } = await readImageDimensions(finalFile);
  const previewUrl = URL.createObjectURL(finalFile);

  return {
    file: finalFile,
    previewUrl,
    originalName: rawFile.name,
    originalSizeBytes: rawFile.size,
    optimizedSizeBytes: finalFile.size,
    width,
    height,
    mimeType: finalFile.type || 'image/jpeg',
    wasConvertedFromHeic,
    wasCompressed,
  };
}

export async function loadSampleRoomImage(maxUploadMb: number): Promise<ProcessedImage> {
  const response = await fetch(SAMPLE_ROOM_ASSET.url);
  if (!response.ok) {
    throw new Error('Could not load the sample living room image.');
  }
  const blob = await response.blob();
  const sampleFile = new File([blob], SAMPLE_ROOM_ASSET.name, {
    type: blob.type || 'image/jpeg',
  });
  return processUploadedImage(sampleFile, { maxUploadMb });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMimeLabel(mime: string): string {
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('webp')) return 'WEBP';
  return 'JPG';
}
