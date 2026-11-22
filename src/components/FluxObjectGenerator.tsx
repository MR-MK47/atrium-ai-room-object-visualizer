import { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { generateFluxImage } from '../lib/api-client';
import { formatBytes, processUploadedImage } from '../lib/image-optimizer';
import type { ProcessedImage } from '../types/visualizer';
import { ErrorBanner } from './ErrorBanner';

interface FluxObjectGeneratorProps {
  maxUploadMb: number;
  disabled?: boolean;
  onObjectGenerated: (img: ProcessedImage) => void;
  activeImage: ProcessedImage | null;
  onClear: () => void;
}

const SAMPLE_PROMPTS = [
  'Modern cream bouclé armchair with walnut legs on pure white studio background',
  'Brushed brass architectural floor lamp with spherical opal glass shade',
  'Large fiddle leaf fig plant in fluted white ceramic cylinder pot',
  'Round solid oak coffee table with fluted pedestal base',
  'Minimalist stainless steel espresso machine with wooden handle',
  'Sculptural matte white ceramic vase with curved asymmetrical handles',
];

export function FluxObjectGenerator({
  maxUploadMb,
  disabled = false,
  onObjectGenerated,
  activeImage,
  onClear,
}: FluxObjectGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const handleGenerate = async (targetPrompt?: string) => {
    const finalPrompt = (targetPrompt || prompt).trim();
    if (!finalPrompt || disabled || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setElapsed(0);

    const timer = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    try {
      // 1. Call Cloudflare Workers AI Flux endpoint
      const result = await generateFluxImage(finalPrompt);

      // 2. Convert returned data URI to a File and process it through standard visualizer optimizer
      const res = await fetch(result.imageUrl);
      const blob = await res.blob();
      const sanitizedName =
        finalPrompt
          .slice(0, 30)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-') + '.jpg';

      const file = new File([blob], sanitizedName, { type: 'image/jpeg' });
      const processed = await processUploadedImage(file, { maxUploadMb });

      onObjectGenerated(processed);
    } catch (err: any) {
      setError({
        message: err.message || 'Failed to generate image with Cloudflare Flux.',
        hint: err.hint,
      });
    } finally {
      clearInterval(timer);
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Active Generated Image Card */}
      {activeImage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <img
                src={activeImage.previewUrl}
                alt={activeImage.originalName}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-950">
                <CheckCircle2 className="h-4 w-4 text-[#1D4ED8]" />
                <span>Generated Flux Object Ready</span>
              </div>
              <p className="mt-1 text-xs text-zinc-600 line-clamp-2 italic">
                "{prompt || activeImage.originalName}"
              </p>
              <p className="mt-1 text-[11px] font-mono text-zinc-500">
                {activeImage.width}x{activeImage.height} • {formatBytes(activeImage.optimizedSizeBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-200/60">
            <button
              type="button"
              disabled={disabled || isGenerating}
              onClick={onClear}
              className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={disabled || isGenerating}
              onClick={() => handleGenerate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-50"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <ErrorBanner
          message={error.message}
          hint={error.hint}
          retryable={true}
          onRetry={() => handleGenerate()}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Prompt Form */}
      <div className="space-y-2">
        <label htmlFor="flux-prompt" className="block text-xs font-semibold text-zinc-900">
          Describe the object to generate with Flux-1 Schnell
        </label>
        <div className="relative">
          <textarea
            id="flux-prompt"
            rows={3}
            maxLength={300}
            disabled={disabled || isGenerating}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Modern walnut lounge chair with cognac leather upholstery on a clean seamless white background"
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8] disabled:opacity-50 resize-none shadow-xs"
          />
          <span className="absolute bottom-2.5 right-3 text-[10px] text-zinc-400 font-mono">
            {prompt.length}/300
          </span>
        </div>
      </div>

      {/* Quick Prompt Ideas */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-zinc-500">Quick ideas:</p>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_PROMPTS.slice(0, 4).map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled || isGenerating}
              onClick={() => {
                setPrompt(p);
                handleGenerate(p);
              }}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition-colors disabled:opacity-50 text-left"
            >
              + {p.split(' ')[0]} {p.split(' ')[1]} {p.split(' ')[2]}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        type="button"
        disabled={disabled || isGenerating || !prompt.trim()}
        onClick={() => handleGenerate()}
        className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            <span>Generating with Flux-1 Schnell ({elapsed}s)...</span>
          </>
        ) : (
          <>
            <Wand2 className="h-3.5 w-3.5 text-amber-400" />
            <span>Generate Object with Flux-1 Schnell</span>
          </>
        )}
      </button>
    </div>
  );
}
