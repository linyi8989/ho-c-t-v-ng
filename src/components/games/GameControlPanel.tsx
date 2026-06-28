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
            className="flex items-center space-x-2 px-6 py-3 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-bold rounded-xl transition-all cursor-pointer border border-white/10 shadow-lg active:scale-95"
            id="premium-prev-btn"
          >
            <ChevronLeft size={18} />
            <span>Prev</span>
          </button>

          {/* Large circular sound button */}
          <button
            onClick={onPlaySound}
            className="p-4 bg-sky-500 hover:bg-sky-600 text-white rounded-full transition-all cursor-pointer shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 border border-sky-400/30 flex items-center justify-center"
            title="Phát âm tiếng Anh"
            id="premium-speak-btn"
          >
            <Volume2 size={24} />
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="flex items-center space-x-2 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition-all cursor-pointer border border-sky-400/30 shadow-lg shadow-sky-500/20 active:scale-95"
            id="premium-next-btn"
          >
            <span>Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Row 2: Status Indicator and Toggles */}
      <div className="flex flex-wrap items-center justify-center gap-6 px-5 py-3.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 w-full shadow-xl">
        {/* Word counter */}
        {showLinearControls && totalItems > 0 && (
          <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-lg text-xs font-bold font-mono shadow-xs">
            Word {currentIndex + 1} / {totalItems}
          </span>
        )}

        {/* Random Toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-300 font-bold select-none">Random</span>
          <button
            type="button"
            onClick={onToggleRandom}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isRandomized ? 'bg-sky-500' : 'bg-slate-700'
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
          <span className="text-xs text-slate-300 font-bold select-none">Sound</span>
          <button
            type="button"
            onClick={onToggleSound}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isSoundOn ? 'bg-sky-500' : 'bg-slate-700'
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
            <span className="text-xs text-slate-300 font-bold select-none">Next</span>
            <button
              type="button"
              onClick={onToggleAutoNext}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAutoNextOn ? 'bg-sky-500' : 'bg-slate-700'
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
          className="flex items-center space-x-1.5 px-3 py-1 bg-slate-850 hover:bg-slate-750 border border-white/10 rounded-lg text-xs font-bold text-slate-300 cursor-pointer transition-all active:scale-95"
          id="premium-fullscreen-btn"
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span>Full screen</span>
        </button>
      </div>
    </div>
  );
}
