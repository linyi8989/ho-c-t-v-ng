import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Volume2, HelpCircle, CheckCircle } from 'lucide-react';
import { VocabItem } from '../../types';
import { speakEnglish } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';

interface FlashcardGameProps {
  items: VocabItem[];
  config: {
    front: 'term' | 'meaning' | 'sound_only';
    back: 'term' | 'meaning' | 'both';
    enableSound?: boolean;
    autoPlaySound?: boolean;
  };
  onComplete: (score: number, correct: number, incorrect: number) => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export default function FlashcardGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
}: FlashcardGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [learnedCount, setLearnedCount] = useState<Record<string, 'known' | 'unknown'>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isAutoNextOn, setIsAutoNextOn] = useState(false);

  const isSoundOn = !isMuted;
  const currentItem = items[currentIndex];

  // Reset indices and counts when items change (e.g. from parent shuffles)
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setLearnedCount({});
    setIsCompleted(false);
  }, [items]);

  // Auto-pronounce on word change
  useEffect(() => {
    if (currentItem && isSoundOn) {
      speakEnglish(currentItem.term);
    }
  }, [currentIndex, currentItem, isSoundOn]);

  // Autoplay Slideshow Mechanism
  useEffect(() => {
    if (!isAutoNextOn || isCompleted || !currentItem) return;

    const timer = setTimeout(() => {
      if (!isFlipped) {
        setIsFlipped(true);
      } else {
        handleNext();
      }
    }, 4000); // 4 seconds auto transition

    return () => clearTimeout(timer);
  }, [currentIndex, isFlipped, isAutoNextOn, isCompleted, items]);

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100" id="empty-state">
        <p>Không có từ vựng nào trong bộ dữ liệu này.</p>
      </div>
    );
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      // Calculate final score
      const correct = Object.values(learnedCount).filter(v => v === 'known').length;
      const total = items.length;
      const correctCount = correct > 0 ? correct : total; // Fallback to all correct if slide-through only
      onComplete(Math.round((correctCount / total) * 100), correctCount, total - correctCount);
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const markLearned = (status: 'known' | 'unknown') => {
    if (!currentItem) return;
    setLearnedCount(prev => ({
      ...prev,
      [currentItem.id]: status
    }));
    handleNext();
  };

  const handlePlaySound = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentItem) {
      speakEnglish(currentItem.term);
    }
  };

  const renderFront = () => {
    if (!currentItem) return null;
    if (config.front === 'sound_only') {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <button
            onClick={handlePlaySound}
            className="p-8 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-full transition-all hover:scale-105 cursor-pointer shadow-sm border border-indigo-500/20"
            id="sound-button-front"
          >
            <Volume2 size={48} className="animate-pulse" />
          </button>
          <span className="text-gray-400 text-sm font-medium">Bấm để nghe phát âm</span>
        </div>
      );
    }

    const value = config.front === 'term' ? currentItem.term : currentItem.meaning;
    const subtitle = config.front === 'term' ? currentItem.pos : '';

    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        {subtitle && (
          <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
            {subtitle}
          </span>
        )}
        <h2 className="text-4xl md:text-5xl font-black text-gray-100 tracking-tight leading-tight word-break select-all">
          {value}
        </h2>
        {config.front === 'term' && currentItem.ipa && (
          <span className="text-lg font-mono text-indigo-400 mt-2 block select-all">
            {currentItem.ipa}
          </span>
        )}
      </div>
    );
  };

  const renderBack = () => {
    if (!currentItem) return null;
    if (config.back === 'both') {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 bg-slate-900">
          <div>
            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold rounded uppercase tracking-wider">
              {currentItem.pos}
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-indigo-400 mt-1 select-all">{currentItem.term}</h2>
            {currentItem.ipa && <p className="text-md font-mono text-indigo-300">{currentItem.ipa}</p>}
          </div>
          <div className="border-t border-white/5 w-full pt-4">
            <h3 className="text-2xl md:text-3xl font-bold text-emerald-400 select-all">{currentItem.meaning}</h3>
          </div>
          {(currentItem.example || currentItem.notes) && (
            <div className="bg-white/5 rounded-xl p-4 max-w-md text-left border border-white/5 w-full mt-2">
              {currentItem.example && (
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-200 italic">“{currentItem.example}”</p>
                  <p className="text-xs text-gray-400 mt-0.5">{currentItem.exampleMeaning}</p>
                </div>
              )}
              {currentItem.notes && (
                <p className="text-xs text-amber-400 font-medium">💡 Ghi chú: {currentItem.notes}</p>
              )}
            </div>
          )}
        </div>
      );
    }

    const value = config.back === 'term' ? currentItem.term : currentItem.meaning;
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-900">
        <h2 className="text-4xl md:text-5xl font-black text-indigo-400 leading-tight select-all">
          {value}
        </h2>
        {config.back === 'term' && currentItem.ipa && (
          <span className="text-lg font-mono text-indigo-300 mt-2 block select-all">
            {currentItem.ipa}
          </span>
        )}
      </div>
    );
  };

  const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

  return (
    <div className="w-full relative max-w-2xl mx-auto" id="flashcard-game-root">
      {/* Game Header Progress */}
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-sm font-semibold text-gray-500">
          Từ {currentIndex + 1} / {items.length}
        </span>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-indigo-600">{progressPercent}% Hoàn thành</span>
        </div>
      </div>

      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
        <motion.div
          className="bg-indigo-600 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main Flashcard Card Container */}
      <div className="relative h-[380px] w-full perspective mb-8">
        <motion.div
          onClick={handleFlip}
          className="relative w-full h-full cursor-pointer transition-all duration-500 transform-style-3d rounded-3xl border border-white/10 shadow-xl hover:shadow-2xl"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          id="flashcard-card-flipper"
        >
          {/* Card Front */}
          <div 
            className="absolute inset-0 backface-hidden w-full h-full bg-slate-900 border border-white/10 flex flex-col justify-between rounded-3xl overflow-hidden"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <div className="flex justify-between items-center px-6 py-4 text-gray-400 border-b border-white/5 text-xs">
              <span className="font-semibold uppercase tracking-wider text-indigo-400">MẶT TRƯỚC</span>
              <span>Bấm vào thẻ để lật xem đáp án</span>
            </div>
            <div className="flex-1 bg-transparent">
              {renderFront()}
            </div>
            <div className="px-6 py-4 bg-white/5 text-center text-xs text-gray-400 border-t border-white/5">
              Nhấn phím SPACE hoặc bấm chuột để lật
            </div>
          </div>

          {/* Card Back */}
          <div 
            className="absolute inset-0 backface-hidden w-full h-full bg-slate-900 border border-white/10 flex flex-col justify-between rounded-3xl overflow-hidden animate-none"
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              WebkitTransform: 'rotateY(180deg)'
            }}
          >
            <div className="flex justify-between items-center px-6 py-4 text-gray-400 border-b border-white/5 text-xs bg-slate-900">
              <span className="font-semibold uppercase tracking-wider text-emerald-400">MẶT SAU (ĐÁP ÁN)</span>
              <span>Bấm vào thẻ để lật lại</span>
            </div>
            <div className="flex-1 bg-slate-900">
              {renderBack()}
            </div>
            <div className="px-6 py-4 bg-white/5 text-center text-xs text-gray-400 border-t border-white/5 bg-slate-900">
              Nhấn phím SPACE hoặc bấm chuột để lật
            </div>
          </div>
        </motion.div>
      </div>

      {/* Learning status option (Tôi đã thuộc / Chưa thuộc) - Show only if flipped */}
      {isFlipped && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => markLearned('unknown')}
            className="flex items-center justify-center space-x-2 py-3 px-5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold rounded-2xl border border-rose-200 transition-all cursor-pointer active:scale-95 text-sm"
            id="mark-unknown-btn"
          >
            <HelpCircle size={18} />
            <span>Tôi chưa thuộc</span>
          </button>
          <button
            onClick={() => markLearned('known')}
            className="flex items-center justify-center space-x-2 py-3 px-5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-bold rounded-2xl border border-emerald-200 transition-all cursor-pointer active:scale-95 text-sm"
            id="mark-known-btn"
          >
            <CheckCircle size={18} />
            <span>Tôi đã thuộc</span>
          </button>
        </div>
      )}

      {/* Shared Premium Slider Controls */}
      <GameControlPanel
        currentIndex={currentIndex}
        totalItems={items.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onPlaySound={handlePlaySound}
        isRandomized={isRandomized}
        onToggleRandom={onToggleRandom}
        isSoundOn={isSoundOn}
        onToggleSound={() => setIsMuted(prev => !prev)}
        isAutoNextOn={isAutoNextOn}
        onToggleAutoNext={() => setIsAutoNextOn(!isAutoNextOn)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  );
}
