import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Eye, X } from 'lucide-react';
import type { ProcessedImage, VariationItem } from '../types/visualizer';

interface LightboxModalProps {
  isOpen: boolean;
  activeVariation: VariationItem | null;
  variations: VariationItem[];
  originalRoomImage: ProcessedImage | null;
  onClose: () => void;
  onNavigate: (item: VariationItem) => void;
}

export function LightboxModal({
  isOpen,
  activeVariation,
  variations,
  originalRoomImage,
  onClose,
  onNavigate,
}: LightboxModalProps) {
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeVariation, variations]);

  if (!isOpen || !activeVariation) return null;

  const currentIndex = variations.findIndex((v) => v.index === activeVariation.index);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < variations.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) {
      onNavigate(variations[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      onNavigate(variations[currentIndex + 1]);
    }
  };

  const currentDisplayUrl =
    isComparingOriginal && originalRoomImage
      ? originalRoomImage.previewUrl
      : activeVariation.imageUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Variation Fullscreen Lightbox"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none"
    >
      {/* Top action bar */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-white/10 text-white">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">
            Variation {activeVariation.index} of {variations.length}
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300 font-mono">
            {activeVariation.aspectRatio} • {activeVariation.resolution}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {originalRoomImage && (
            <button
              type="button"
              onMouseDown={() => setIsComparingOriginal(true)}
              onMouseUp={() => setIsComparingOriginal(false)}
              onMouseLeave={() => setIsComparingOriginal(false)}
              onTouchStart={() => setIsComparingOriginal(true)}
              onTouchEnd={() => setIsComparingOriginal(false)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isComparingOriginal
                  ? 'bg-amber-500 text-zinc-950 shadow-lg'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isComparingOriginal ? 'Showing Original Room' : 'Hold to Compare Original'}</span>
            </button>
          )}

          <a
            href={activeVariation.downloadUrl}
            download={`atrium-variation-${activeVariation.index}.png`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download HD</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Lightbox"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        {hasPrevious && (
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous variation"
            className="absolute left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-xs"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="relative max-h-full max-w-full flex items-center justify-center">
          <img
            src={currentDisplayUrl}
            alt={
              isComparingOriginal
                ? 'Original Room Photo'
                : `Generated Variation ${activeVariation.index}`
            }
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-all"
          />
          {isComparingOriginal && (
            <div className="absolute top-4 left-4 rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-zinc-950 shadow">
              Original Room
            </div>
          )}
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next variation"
            className="absolute right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-xs"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
