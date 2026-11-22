import { SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  hasResults: boolean;
}

export function Header({ onOpenSettings, hasResults }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#workspace"
          className="font-display text-xl font-semibold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 rounded"
        >
          Atrium
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600"
        >
          <a
            href="#workspace"
            className="whitespace-nowrap shrink-0 hover:text-zinc-950 hover:underline underline-offset-4 transition-colors"
          >
            Workspace
          </a>
          <a
            href="#object-input"
            className="whitespace-nowrap shrink-0 hover:text-zinc-950 hover:underline underline-offset-4 transition-colors"
          >
            Sample Catalog
          </a>
          <a
            href={hasResults ? '#results' : '#controls'}
            className="whitespace-nowrap shrink-0 hover:text-zinc-950 hover:underline underline-offset-4 transition-colors"
          >
            Results
          </a>
          <button
            type="button"
            onClick={onOpenSettings}
            className="whitespace-nowrap shrink-0 hover:text-zinc-950 hover:underline underline-offset-4 transition-colors"
          >
            Guardrails
          </button>
        </nav>

        {/* Zone 3: Single utility action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
          >
            <SlidersHorizontal className="h-4 w-4 text-zinc-600" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
