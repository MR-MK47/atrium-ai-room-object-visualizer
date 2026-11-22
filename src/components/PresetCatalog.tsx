import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { PRESET_CATALOG, PRESET_CATEGORIES, type PresetCategoryFilter } from '../lib/presets';
import type { PresetItem } from '../types/visualizer';

interface PresetCatalogProps {
  selectedPresetId: string | null;
  onSelectPreset: (preset: PresetItem) => void;
  disabled?: boolean;
}

export function PresetCatalog({
  selectedPresetId,
  onSelectPreset,
  disabled = false,
}: PresetCatalogProps) {
  const [activeCategory, setActiveCategory] = useState<PresetCategoryFilter>('All');

  const filteredPresets =
    activeCategory === 'All'
      ? PRESET_CATALOG
      : PRESET_CATALOG.filter((item) => item.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Catalog Categories">
        {PRESET_CATEGORIES.map((category) => {
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 max-h-[360px] overflow-y-auto pr-1">
        {filteredPresets.map((item) => {
          const isSelected = selectedPresetId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(item)}
              aria-pressed={isSelected}
              className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-[#1D4ED8] bg-blue-50/30 ring-2 ring-[#1D4ED8] ring-offset-1'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm'
              } disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                <img
                  src={item.thumbnailUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1D4ED8] text-white shadow">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                )}
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                  {item.category}
                </span>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col p-2.5">
                <p className="text-xs font-semibold text-zinc-900 line-clamp-1">{item.name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
