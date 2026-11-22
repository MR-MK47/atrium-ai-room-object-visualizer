import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, Sliders, X } from 'lucide-react';
import {
  fetchSettings,
  resetAppSettings,
  resetDailyUsageCounter,
  updateAppSettings,
} from '../lib/api-client';
import type { AppSettings, ImageModelId, OutputResolution, SettingsResponse } from '../types/visualizer';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: (settings: AppSettings) => void;
}

export function SettingsModal({ isOpen, onClose, onSettingsUpdated }: SettingsModalProps) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchSettings();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (partial: Partial<AppSettings>) => {
    if (!data) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateAppSettings(partial);
      setData(updated);
      onSettingsUpdated?.(updated.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset all visualizer settings and guardrails to defaults?')) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await resetAppSettings();
      setData(updated);
      onSettingsUpdated?.(updated.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetQuota = async () => {
    setIsSaving(true);
    try {
      const updated = await resetDailyUsageCounter();
      setData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset usage');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const settings = data?.settings;
  const usage = data?.usage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-zinc-700" />
            <h2 id="settings-dialog-title" className="text-lg font-semibold text-zinc-950">
              Settings & Guardrails
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-2.5 text-xs text-green-800 border border-green-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Settings updated successfully</span>
          </div>
        )}

        {isLoading || !settings ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading settings...</div>
        ) : (
          <div className="mt-5 space-y-6">
            {/* API Key Status */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900">Gemini API Status</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {data.hasApiKeyConfigured
                      ? 'Valid API key active in server environment.'
                      : 'API key is not configured. Add GEMINI_API_KEY in .env.'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    data.hasApiKeyConfigured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      data.hasApiKeyConfigured ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  />
                  {data.hasApiKeyConfigured ? 'Connected' : 'Missing Key'}
                </span>
              </div>
            </div>

            {/* AI Provider Switcher */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-900">
                  Active AI Provider
                </label>
                <span className="text-[11px] font-mono text-zinc-500">
                  switchable via AI_PROVIDER in .env
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'gemini',
                    label: 'Google Gemini',
                    desc: 'Native multi-image editing & composite staging',
                  },
                  {
                    id: 'cloudflare',
                    label: 'Cloudflare Workers AI',
                    desc: 'Flux-1 Schnell generation via Cloudflare edge',
                  },
                ].map((p) => {
                  const isSelected = settings.provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleUpdate({ provider: p.id as any })}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-[#1D4ED8] bg-blue-50/40 ring-1 ring-[#1D4ED8]'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-900">{p.label}</p>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500 leading-tight">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Model Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-900">
                  Active Image Generation Model
                </label>
                <span className="text-[11px] font-mono text-zinc-500">
                  from .env or selection
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: '@cf/black-forest-labs/flux-2-klein-4b',
                    label: 'FLUX.2 [klein] 4B (Recommended)',
                    desc: 'Direct multi-image editing model preserving exact locked room and adding object with realistic contact shadows',
                  },
                  {
                    id: '@cf/black-forest-labs/flux-1-schnell',
                    label: 'Cloudflare Flux-1 Schnell',
                    desc: 'High-speed 12B parameter rectified flow model via Workers AI',
                  },
                  {
                    id: 'gemini-nano-banana-2.1',
                    label: 'Gemini Nano Banana 2.1',
                    desc: 'Default composite model with lighting/perspective awareness',
                  },
                  {
                    id: 'gemini-3.1-flash-lite-image',
                    label: 'Gemini 3.1 Flash Lite',
                    desc: 'Ultra-fast low-latency image generation model',
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleUpdate({ model: m.id as ImageModelId })}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      settings.model === m.id
                        ? 'border-[#1D4ED8] bg-blue-50/40 ring-1 ring-[#1D4ED8]'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-900">{m.label}</p>
                      {settings.model === m.id && (
                        <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 leading-tight">{m.desc}</p>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                You can switch models in your <code className="font-mono text-zinc-600">.env</code> file via{' '}
                <code className="font-mono text-zinc-600">GEMINI_IMAGE_MODEL</code> or{' '}
                <code className="font-mono text-zinc-600">CLOUDFLARE_IMAGE_MODEL</code>.
              </p>
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-xs font-semibold text-zinc-900 mb-2">
                Output Resolution
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['1K', '2K', '4K'] as OutputResolution[]).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => handleUpdate({ resolution: res })}
                    className={`rounded-xl border py-2.5 px-3 text-center text-xs font-medium transition-all ${
                      settings.resolution === res
                        ? 'border-[#1D4ED8] bg-blue-50/50 text-[#1D4ED8] font-semibold'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {res} {res === '2K' && '(Recommended)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Upload Size */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-zinc-900">Max Upload Size</span>
                <span className="font-mono text-zinc-600">{settings.maxUploadMb} MB</span>
              </div>
              <input
                type="range"
                min="5"
                max="20"
                step="1"
                value={settings.maxUploadMb}
                onChange={(e) => handleUpdate({ maxUploadMb: Number(e.target.value) })}
                className="studio-slider w-full"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Guardrail limit for raw image uploads before client compression.
              </p>
            </div>

            {/* Usage Quota Status */}
            {usage && (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900">Daily Generation Quota</span>
                  <button
                    type="button"
                    onClick={handleResetQuota}
                    className="text-[11px] font-medium text-[#1D4ED8] hover:underline"
                  >
                    Reset Usage
                  </button>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-zinc-900">{usage.usedToday}</span>
                  <span className="text-xs text-zinc-500">
                    / {usage.enforced ? usage.limit : 'Unlimited'} generations today
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
