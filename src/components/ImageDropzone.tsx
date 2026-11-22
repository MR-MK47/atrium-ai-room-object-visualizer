import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, Loader2, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import {
  FILE_INPUT_ACCEPT,
  formatBytes,
  formatMimeLabel,
  ImageValidationError,
  processUploadedImage,
} from '../lib/image-optimizer';
import type { ProcessedImage } from '../types/visualizer';
import { ErrorBanner } from './ErrorBanner';

interface ImageDropzoneProps {
  id: string;
  label: string;
  emptyTitle: string;
  emptySubtitle: string;
  image: ProcessedImage | null;
  maxUploadMb: number;
  disabled?: boolean;
  onImageProcessed: (img: ProcessedImage) => void;
  onRemove: () => void;
  onLoadSample?: () => Promise<void>;
  sampleButtonLabel?: string;
}

export function ImageDropzone({
  id,
  label,
  emptyTitle,
  emptySubtitle,
  image,
  maxUploadMb,
  disabled = false,
  onImageProcessed,
  onRemove,
  onLoadSample,
  sampleButtonLabel,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    setLocalError(null);
    setProcessingStage('Validating photo...');
    try {
      const processed = await processUploadedImage(file, {
        maxUploadMb,
        onProgressStage: (stage) => setProcessingStage(stage),
      });
      onImageProcessed(processed);
    } catch (err) {
      if (err instanceof ImageValidationError) {
        setLocalError(err.message);
      } else {
        setLocalError('Could not process that image file. Please choose another photo.');
      }
    } finally {
      setProcessingStage(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const droppedFile = e.dataTransfer.files?.[0];
    void handleFile(droppedFile);
  };

  const handleSampleClick = async () => {
    if (!onLoadSample || disabled) return;
    setLocalError(null);
    setProcessingStage('Loading sample scene...');
    try {
      await onLoadSample();
    } catch {
      setLocalError('Could not load sample room photo. Please upload your own photo.');
    } finally {
      setProcessingStage(null);
    }
  };

  const openFilePicker = () => {
    if (!disabled && !processingStage) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        onChange={handleInputChange}
        disabled={disabled || Boolean(processingStage)}
        className="sr-only"
        aria-label={label}
      />

      {image ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
            <div className="flex h-[280px] sm:h-[310px] w-full items-center justify-center p-2">
              <img
                src={image.previewUrl}
                alt={image.originalName}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>

            {processingStage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 backdrop-blur-xs">
                <Loader2 className="h-5 w-5 animate-spin text-[#1D4ED8]" aria-hidden="true" />
                <p className="text-sm font-medium text-zinc-900">{processingStage}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900" title={image.originalName}>
                {image.originalName}
              </p>
              <p className="font-mono text-xs text-zinc-500 tabular-nums">
                {formatMimeLabel(image.mimeType)}
                <span aria-hidden="true"> · </span>
                {image.width} × {image.height}
                <span aria-hidden="true"> · </span>
                {formatBytes(image.optimizedSizeBytes)}
                {image.wasConvertedFromHeic && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>HEIC converted</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={disabled || Boolean(processingStage)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  onRemove();
                }}
                disabled={disabled || Boolean(processingStage)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault();
                openFilePicker();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group flex min-h-[280px] sm:min-h-[310px] flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 ${
              isDragging
                ? 'border-[#1D4ED8] bg-[#1D4ED8]/5'
                : 'border-zinc-300 bg-zinc-50/70 hover:border-zinc-400 hover:bg-zinc-100/70'
            } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            {processingStage ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-[#1D4ED8]" aria-hidden="true" />
                <p className="text-sm font-medium text-zinc-900">{processingStage}</p>
                <p className="text-xs text-zinc-500">
                  Resizing and preparing image for photorealistic composition
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-xs transition-transform duration-150 group-hover:-translate-y-0.5">
                  {isDragging ? (
                    <Upload className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>

                <p className="text-sm font-semibold text-zinc-900">{emptyTitle}</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                  {emptySubtitle}
                </p>

                <span className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-900 shadow-xs group-hover:border-zinc-300">
                  Choose Image
                </span>

                <p className="mt-4 font-mono text-[11px] text-zinc-500">
                  JPG, PNG, WEBP, HEIC · Max {maxUploadMb}MB
                </p>
              </>
            )}
          </div>

          {onLoadSample && (
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span>Want to test immediately?</span>
              <button
                type="button"
                onClick={() => void handleSampleClick()}
                disabled={disabled || Boolean(processingStage)}
                className="inline-flex items-center gap-1.5 font-medium text-[#1D4ED8] hover:text-[#1E40AF] hover:underline underline-offset-4 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{sampleButtonLabel || 'Load sample living room'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {localError && (
        <ErrorBanner
          title="File not accepted"
          message={localError}
          onDismiss={() => setLocalError(null)}
        />
      )}
    </div>
  );
}
