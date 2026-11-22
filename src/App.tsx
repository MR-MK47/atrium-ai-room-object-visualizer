import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { ErrorBanner } from './components/ErrorBanner';
import { FluxObjectGenerator } from './components/FluxObjectGenerator';
import { Header } from './components/Header';
import { ImageDropzone } from './components/ImageDropzone';
import { LightboxModal } from './components/LightboxModal';
import { PresetCatalog } from './components/PresetCatalog';
import { ResultsGallery } from './components/ResultsGallery';
import { SettingsModal } from './components/SettingsModal';
import { generateVariations } from './lib/api-client';
import { loadSampleRoomImage } from './lib/image-optimizer';
import { PRESET_CATALOG } from './lib/presets';
import type {
  AppStatus,
  GenerationResponse,
  ObjectInputMode,
  PresetItem,
  ProcessedImage,
  VariationCount,
  VariationItem,
} from './types/visualizer';

const MAX_INSTRUCTION_CHARS = 300;

export default function App() {
  // Input states
  const [background, setBackground] = useState<ProcessedImage | null>(null);
  const [objectMode, setObjectMode] = useState<ObjectInputMode>('preset');
  const [customObject, setCustomObject] = useState<ProcessedImage | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetItem | null>(PRESET_CATALOG[0]);
  const [variationCount, setVariationCount] = useState<VariationCount>(2);
  const [instructions, setInstructions] = useState('');

  // App lifecycle & feedback states
  const [status, setStatus] = useState<AppStatus>('idle');
  const [loadingPhase, setLoadingPhase] = useState('Preparing composition...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generation, setGeneration] = useState<GenerationResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    hint?: string;
    retryable?: boolean;
  } | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightboxVariation, setLightboxVariation] = useState<VariationItem | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const isGenerating = status === 'generating';
  const hasObject = objectMode === 'preset' ? Boolean(selectedPreset) : Boolean(customObject);
  const canGenerate = Boolean(background) && hasObject && !isGenerating;

  // Elapsed timer during generation
  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      const interval = window.setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
      timerRef.current = interval;

      // Dynamic phased messaging
      const p1 = window.setTimeout(() => setLoadingPhase('Analyzing lighting, shadows & perspective...'), 3500);
      const p2 = window.setTimeout(() => setLoadingPhase('Synthesizing photorealistic composite variations...'), 11000);
      const p3 = window.setTimeout(() => setLoadingPhase('Finalizing high-resolution details...'), 22000);

      return () => {
        clearInterval(interval);
        clearTimeout(p1);
        clearTimeout(p2);
        clearTimeout(p3);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isGenerating]);

  // Load sample room handler
  const handleLoadSampleRoom = async () => {
    setErrorInfo(null);
    try {
      const sample = await loadSampleRoomImage(10);
      setBackground(sample);
    } catch (err) {
      setErrorInfo({
        message: 'Could not load sample room photo.',
        hint: 'Please upload a photo of your own room to get started.',
        retryable: true,
      });
    }
  };

  // Preset selection handler
  const handleSelectPreset = (preset: PresetItem) => {
    setSelectedPreset(preset);
  };

  // Generation trigger
  const handleGenerate = async () => {
    if (!background || (!customObject && !selectedPreset)) return;

    setStatus('generating');
    setErrorInfo(null);
    setLoadingPhase('Uploading and validating images...');

    try {
      const res = await generateVariations({
        backgroundFile: background.file,
        backgroundWidth: background.width,
        backgroundHeight: background.height,
        objectFile: objectMode === 'upload' ? customObject?.file : undefined,
        presetId: objectMode === 'preset' ? selectedPreset?.id : undefined,
        variationCount,
        instructions: instructions.trim(),
      });

      setGeneration(res);
      setStatus('success');

      // Scroll smoothly to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setStatus('error');
      setErrorInfo({
        message: err.message || 'Failed to generate variations. Please try again.',
        hint: err.hint,
        retryable: err.retryable ?? true,
      });
    }
  };

  // Reset all
  const handleStartOver = () => {
    setBackground(null);
    setCustomObject(null);
    setSelectedPreset(PRESET_CATALOG[0]);
    setInstructions('');
    setGeneration(null);
    setErrorInfo(null);
    setStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111113] flex flex-col font-sans">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} hasResults={Boolean(generation)} />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="space-y-2 text-center max-w-2xl mx-auto pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>AI Room & Object Staging Studio</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950">
            Preview any object inside your room
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Upload your room photo, select any object, and preview realistic lighting, scale, perspective,
            and contact shadows in seconds.
          </p>
        </div>

        {/* Global Error Notice */}
        {errorInfo && (
          <ErrorBanner
            message={errorInfo.message}
            hint={errorInfo.hint}
            retryable={errorInfo.retryable}
            showSettingsAction={errorInfo.message.toLowerCase().includes('key')}
            onRetry={handleGenerate}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDismiss={() => setErrorInfo(null)}
          />
        )}

        {/* Workspace 2-Column Grid */}
        <div id="workspace" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-20">
          {/* Step 1: Background Room Dropzone */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <ImageDropzone
              id="room-input"
              label="Step 1: Room Photo (Background Scene)"
              emptyTitle="Drop room photo here, or browse"
              emptySubtitle="Living room, patio, kitchen, office desk, or empty corner"
              image={background}
              maxUploadMb={10}
              disabled={isGenerating}
              onImageProcessed={setBackground}
              onRemove={() => setBackground(null)}
              onLoadSample={handleLoadSampleRoom}
              sampleButtonLabel="Load Sample Room"
            />
          </div>

          {/* Step 2: Object Selection */}
          <div
            id="object-input"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between scroll-mt-20"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wide uppercase text-zinc-500">
                  Step 2: Choose Target Object
                </span>

                {/* Tab Switcher */}
                <div className="inline-flex rounded-lg bg-zinc-100 p-0.5" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={objectMode === 'preset'}
                    disabled={isGenerating}
                    onClick={() => setObjectMode('preset')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      objectMode === 'preset'
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    } disabled:opacity-50`}
                  >
                    Sample Catalog
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={objectMode === 'upload'}
                    disabled={isGenerating}
                    onClick={() => setObjectMode('upload')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      objectMode === 'upload'
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    } disabled:opacity-50`}
                  >
                    Upload Any Object
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={objectMode === 'flux'}
                    disabled={isGenerating}
                    onClick={() => setObjectMode('flux')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      objectMode === 'flux'
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    } disabled:opacity-50`}
                  >
                    ✨ Flux AI Generator
                  </button>
                </div>
              </div>

              {objectMode === 'preset' ? (
                <div className="space-y-3">
                  <PresetCatalog
                    selectedPresetId={selectedPreset?.id || null}
                    onSelectPreset={handleSelectPreset}
                    disabled={isGenerating}
                  />
                  {selectedPreset && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[#1D4ED8]" />
                        <span className="font-semibold text-zinc-900">{selectedPreset.name}</span>
                        <span className="text-zinc-500">({selectedPreset.category})</span>
                      </div>
                      <span className="text-[11px] font-medium text-[#1D4ED8]">Selected</span>
                    </div>
                  )}
                </div>
              ) : objectMode === 'flux' ? (
                <FluxObjectGenerator
                  maxUploadMb={10}
                  disabled={isGenerating}
                  activeImage={customObject}
                  onObjectGenerated={(img) => {
                    setCustomObject(img);
                    setSelectedPreset(null);
                  }}
                  onClear={() => setCustomObject(null)}
                />
              ) : (
                <ImageDropzone
                  id="custom-object-input"
                  label="Upload Object Photo"
                  emptyTitle="Drop object photo here, or browse"
                  emptySubtitle="Furniture, decor, lamp, plants, art, or any product"
                  image={customObject}
                  maxUploadMb={10}
                  disabled={isGenerating}
                  onImageProcessed={setCustomObject}
                  onRemove={() => setCustomObject(null)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Controls Bar */}
        <div
          id="controls"
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6 scroll-mt-20"
        >
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Sliders className="h-4 w-4 text-zinc-700" />
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wide">
              Step 3: Staging Options & Placement
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Variation Count Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                <label htmlFor="variation-slider" className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-zinc-600" />
                  <span>Number of Variations</span>
                </label>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-zinc-800">
                  {variationCount} {variationCount === 1 ? 'variation' : 'variations'}
                </span>
              </div>

              <input
                id="variation-slider"
                type="range"
                min="1"
                max="3"
                step="1"
                value={variationCount}
                disabled={isGenerating}
                onChange={(e) => setVariationCount(Number(e.target.value) as VariationCount)}
                className="studio-slider w-full"
                aria-label="Variation count slider"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={variationCount}
              />

              <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                <span>1 (Fastest)</span>
                <span className="font-semibold text-zinc-600">2 (Default)</span>
                <span>3 (Comprehensive)</span>
              </div>
            </div>

            {/* Optional Placement Instructions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                <label htmlFor="placement-instructions" className="flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-zinc-600" />
                  <span>Placement Instructions (Optional)</span>
                </label>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {instructions.length}/{MAX_INSTRUCTION_CHARS}
                </span>
              </div>

              <textarea
                id="placement-instructions"
                rows={2}
                maxLength={MAX_INSTRUCTION_CHARS}
                disabled={isGenerating}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Leave blank for automatic placement, or try: 'Place against the left wall next to the window, angled slightly toward the room'"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1D4ED8] transition-all disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-zinc-100">
            <div className="text-xs text-zinc-500">
              {!background ? (
                <span>⚠️ Please upload a room photo first (Step 1).</span>
              ) : !hasObject ? (
                <span>⚠️ Please select or upload an object (Step 2).</span>
              ) : (
                <span className="text-emerald-700 font-medium">
                  ✓ Ready to stage{' '}
                  <span className="font-semibold">
                    {objectMode === 'preset' ? selectedPreset?.name : customObject?.originalName}
                  </span>{' '}
                  in your room.
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#1E40AF] transition-all disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating {variationCount} Variations...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Generate {variationCount} Variations</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading In-Flight Skeleton Grid */}
        {isGenerating && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/20 p-8 text-center space-y-6">
            <div className="max-w-md mx-auto space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#1D4ED8] animate-bounce">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-950">{loadingPhase}</h3>
              <p className="text-xs text-zinc-500">
                Elapsed: <span className="font-mono font-medium text-zinc-800">{elapsedSeconds}s</span>{' '}
                • Target response under 30 seconds
              </p>
            </div>

            {/* Skeleton Cards */}
            <div
              className={`grid gap-4 ${
                variationCount === 1
                  ? 'grid-cols-1 max-w-md mx-auto'
                  : variationCount === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto'
                  : 'grid-cols-1 md:grid-cols-3'
              }`}
            >
              {Array.from({ length: variationCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-[4/3] rounded-xl border border-zinc-200 bg-zinc-100 animate-pulse flex items-center justify-center"
                >
                  <span className="text-xs font-mono text-zinc-400">Rendering Variation {idx + 1}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Section */}
        <div ref={resultsRef}>
          {generation && (
            <ResultsGallery
              generation={generation}
              onSelectVariation={(v) => setLightboxVariation(v)}
              onRegenerate={handleGenerate}
              onStartOver={handleStartOver}
              isGenerating={isGenerating}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500">
          <div>Atrium — AI Room & Object Visualizer</div>
          <div>Powered by Google Gemini 2.5/2.0 API • 24-hour Auto-Expiring Storage</div>
        </div>
      </footer>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={Boolean(lightboxVariation)}
        activeVariation={lightboxVariation}
        variations={generation?.variations || []}
        originalRoomImage={background}
        onClose={() => setLightboxVariation(null)}
        onNavigate={(item) => setLightboxVariation(item)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
