import React from 'react';
import { ChevronLeft, ChevronRight, Volume2, Maximize2, Minimize2 } from 'lucide-react';

interface GameControlPanelProps {
  currentIndex?: number;
  totalItems?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onPlaySound?: () => void;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isSoundOn: boolean;
  onToggleSound: () => void;
  isAutoNextOn?: boolean;
  onToggleAutoNext?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showLinearControls?: boolean;
}

export default function GameControlPanel({
  currentIndex = 0,
  totalItems = 0,
  onPrev,
  onNext,
  onPlaySound,
  isRandomized,
  onToggleRandom,
  isSoundOn,
  onToggleSound,
  isAutoNextOn = false,
  onToggleAutoNext,
  isFullscreen,
  onToggleFullscreen,
  showLinearControls = true,
}: GameControlPanelProps) {
  return (
    <div className="flex flex-col items-center space-y-6 mt-8 w-full" id="premium-slider-controls">
      {/* Row 1: Prev, Speaker, Next (Show only for linear games) */}
      {showLinearControls && (
        <div className="flex items-center justify-center space-x-6">
          {/* Prev Button */}
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-white hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-white text-slate-950 font-bold rounded-xl transition-all cursor-pointer border border-emerald-100 shadow-sm active:scale-95"
            id="premium-prev-btn"
          >
            <ChevronLeft size={18} />
            <span>Trước</span>
          </button>

          {/* Large circular sound button */}
          <button
            onClick={onPlaySound}
            className="p-4 bg-emerald-100 hover:bg-emerald-200 text-slate-950 rounded-full transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 border border-emerald-300 flex items-center justify-center"
            title="Phát âm tiếng Anh"
            id="premium-speak-btn"
          >
            <Volume2 size={24} />
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="flex items-center space-x-2 px-6 py-3 bg-emerald-100 hover:bg-emerald-200 text-slate-950 font-bold rounded-xl transition-all cursor-pointer border border-emerald-300 shadow-sm active:scale-95"
            id="premium-next-btn"
          >
            <span>Tiếp</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Row 2: Status Indicator and Toggles */}
      <div className="flex flex-wrap items-center justify-center gap-6 px-5 py-3.5 bg-white backdrop-blur-md rounded-2xl border border-emerald-100 w-full shadow-sm">
        {/* Word counter */}
        {showLinearControls && totalItems > 0 && (
          <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-slate-950 rounded-lg text-xs font-bold font-mono shadow-xs">
            Từ {currentIndex + 1} / {totalItems}
          </span>
        )}

        {/* Random Toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-950 font-bold select-none">Ngẫu nhiên</span>
          <button
            type="button"
            onClick={onToggleRandom}
            aria-label="Bật hoặc tắt thứ tự ngẫu nhiên"
            aria-pressed={isRandomized}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isRandomized ? 'bg-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-200'
            }`}
            id="toggle-random"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isRandomized ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-950 font-bold select-none">Âm thanh</span>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label="Bật hoặc tắt âm thanh"
            aria-pressed={isSoundOn}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isSoundOn ? 'bg-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-200'
            }`}
            id="toggle-sound"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isSoundOn ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Next Toggle (Auto-advance Autoplay - Show only if supported/linear) */}
        {showLinearControls && onToggleAutoNext && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-950 font-bold select-none">Tự chuyển</span>
            <button
              type="button"
              onClick={onToggleAutoNext}
              aria-label="Bật hoặc tắt tự động chuyển thẻ"
              aria-pressed={isAutoNextOn}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAutoNextOn ? 'bg-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-200'
              }`}
              id="toggle-autonext"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isAutoNextOn ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* Full Screen button */}
        <button
          onClick={onToggleFullscreen}
          className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg text-xs font-bold text-slate-950 cursor-pointer transition-all active:scale-95"
          id="premium-fullscreen-btn"
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span>Toàn màn hình</span>
        </button>
      </div>
    </div>
  );
}
