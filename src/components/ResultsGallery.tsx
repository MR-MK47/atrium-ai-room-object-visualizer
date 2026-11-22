import { Download, Maximize2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import type { GenerationResponse, VariationItem } from '../types/visualizer';

interface ResultsGalleryProps {
  generation: GenerationResponse;
  onSelectVariation: (item: VariationItem) => void;
  onRegenerate: () => void;
  onStartOver: () => void;
  isGenerating?: boolean;
}

export function ResultsGallery({
  generation,
  onSelectVariation,
  onRegenerate,
  onStartOver,
  isGenerating = false,
}: ResultsGalleryProps) {
  const { variations, durationMs, model, resolution } = generation;

  return (
    <section id="results" className="scroll-mt-20 space-y-6 pt-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl font-semibold text-zinc-950">Generated Staging Variations</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {variations.length} variation{variations.length > 1 ? 's' : ''} generated in{' '}
            {(durationMs / 1000).toFixed(1)}s using <span className="font-mono">{model}</span> at{' '}
            <span className="font-mono">{resolution}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <button
            type="button"
            onClick={onStartOver}
            disabled={isGenerating}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Start Over</span>
          </button>
        </div>
      </div>

      {/* Variation Grid */}
      <div
        className={`grid gap-6 ${
          variations.length === 1
            ? 'grid-cols-1 max-w-2xl mx-auto'
            : variations.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-3'
        }`}
      >
        {variations.map((item) => (
          <div
            key={item.index}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md"
          >
            {/* Image Container */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
              <img
                src={item.imageUrl}
                alt={`Variation ${item.index}`}
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-102"
              />

              {/* Top overlay badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Variation {item.index}</span>
              </div>

              {/* Hover inspect pill */}
              <button
                type="button"
                onClick={() => onSelectVariation(item)}
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`View full screen variation ${item.index}`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-xs">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Inspect Fullscreen</span>
                </span>
              </button>
            </div>

            {/* Bottom info & actions */}
            <div className="flex items-center justify-between p-4 bg-zinc-50/50 border-t border-zinc-100">
              <div className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-800">Variation {item.index}</span> •{' '}
                {item.aspectRatio}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectVariation(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Expand</span>
                </button>

                <a
                  href={item.downloadUrl}
                  download={`atrium-variation-${item.index}.png`}
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
