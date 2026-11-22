import { AlertCircle, AlertTriangle, RefreshCw, SlidersHorizontal, X } from 'lucide-react';

interface ErrorBannerProps {
  title?: string;
  message: string;
  hint?: string;
  tone?: 'error' | 'warning';
  retryable?: boolean;
  showSettingsAction?: boolean;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({
  title,
  message,
  hint,
  tone = 'error',
  retryable = false,
  showSettingsAction = false,
  onRetry,
  onOpenSettings,
  onDismiss,
}: ErrorBannerProps) {
  const isWarning = tone === 'warning';

  return (
    <div
      role={isWarning ? 'status' : 'alert'}
      className={`rounded-xl border p-4 ${
        isWarning
          ? 'border-amber-200 bg-amber-50/80 text-amber-950'
          : 'border-red-200 bg-red-50/80 text-red-950'
      }`}
    >
      <div className="flex items-start gap-3">
        {isWarning ? (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {title || (isWarning ? 'Partial result notice' : 'Unable to complete request')}
            </p>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss message"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 hover:text-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <p className="text-sm leading-relaxed opacity-90">{message}</p>
          {hint && <p className="text-xs leading-relaxed opacity-75">{hint}</p>}

          {(retryable || showSettingsAction) && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {retryable && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Try Again</span>
                </button>
              )}
              {showSettingsAction && onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Settings</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
