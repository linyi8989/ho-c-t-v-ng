import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Volume2, HelpCircle, CheckCircle } from 'lucide-react';
import { GameAction, GameAnswerDetail, GameCompletionDetails, VocabItem } from '../../types';
import { playVocabAudio } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';
import VocabItemImage from './VocabItemImage';
import './FlashcardGame.css';

interface FlashcardGameProps {
  items: VocabItem[];
  config: {
    front: 'term' | 'meaning' | 'sound_only';
    back: 'term' | 'meaning' | 'both';
    enableSound?: boolean;
    autoPlaySound?: boolean;
    imagePolicy?: 'prompt' | 'answer' | 'none';
  };
  onComplete: (score: number, correct: number, incorrect: number, details?: GameCompletionDetails) => void;
  onAction?: (action: Omit<GameAction, 'actionId' | 'sequence'>) => void;
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
  onAction,
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
  const answerDetailsRef = useRef<GameAnswerDetail[]>([]);
  const reduceMotion = useReducedMotion();

  const isSoundOn = !isMuted;
  const currentItem = items[currentIndex];

  // Reset indices and counts when the deck or flashcard mode changes.
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setLearnedCount({});
    setIsCompleted(false);
    setIsAutoNextOn(false);
    answerDetailsRef.current = [];
  }, [items, config]);

  // Auto-pronounce on word change
  useEffect(() => {
    if (currentItem && isSoundOn) {
      playVocabAudio(currentItem);
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

  const completeWithStatus = (statusByItemId: Record<string, 'known' | 'unknown'>) => {
    if (isCompleted) return;
    const total = items.length;
    const details = items.map((item, index) => {
      const status = statusByItemId[item.id] || 'unknown';
      return {
        questionIndex: index,
        wordId: item.id,
        word: item.term,
        questionText: config.front === 'meaning' ? item.meaning : item.term,
        correctAnswer: config.back === 'meaning' ? item.meaning : item.term,
        userAnswer: status === 'known' ? 'Da thuoc' : 'Chua thuoc',
        isCorrect: status === 'known'
      };
    });
    const correctCount = details.filter(detail => detail.isCorrect).length;
    answerDetailsRef.current = details;
    onComplete(Math.round((correctCount / total) * 100), correctCount, total - correctCount, {
      answerDetails: details
    });
    setIsCompleted(true);
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      completeWithStatus(learnedCount);
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
    const nextLearned = {
      ...learnedCount,
      [currentItem.id]: status
    };
    answerDetailsRef.current = [
      ...answerDetailsRef.current.filter(detail => detail.wordId !== currentItem.id),
      {
        questionIndex: currentIndex,
        wordId: currentItem.id,
        word: currentItem.term,
        questionText: config.front === 'meaning' ? currentItem.meaning : currentItem.term,
        correctAnswer: config.back === 'meaning' ? currentItem.meaning : currentItem.term,
        userAnswer: status === 'known' ? 'Đã thuộc' : 'Chưa thuộc',
        isCorrect: status === 'known'
      }
    ];
    setLearnedCount(nextLearned);
    onAction?.({ type: 'flashcard.rate', wordId: currentItem.id, userAnswer: status });

    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      completeWithStatus(nextLearned);
    }
  };

  const handlePlaySound = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentItem) {
      playVocabAudio(currentItem);
    }
  };

  const renderFront = () => {
    if (!currentItem) return null;
    if (config.front === 'sound_only') {
      return (
        <div className="flashcard-face-content flex flex-col items-center justify-center space-y-4">
          <button
            onClick={handlePlaySound}
            className="p-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all hover:scale-105 cursor-pointer shadow-sm border border-blue-700"
            id="sound-button-front"
            aria-label="Nghe phát âm của từ"
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
      <div className="flashcard-face-content flex flex-col items-center justify-center p-6 text-center">
        {config.imagePolicy === 'prompt' && (
          <VocabItemImage item={currentItem} theme="dark" className="mb-3" />
        )}
        {subtitle && (
          <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
            {subtitle}
          </span>
        )}
        <h2 data-flashcard-text-size={value.length <= 18 ? 'short' : 'long'} className="flashcard-text font-black text-gray-100 tracking-tight leading-tight select-all">
          {value}
        </h2>
        {config.front === 'term' && currentItem.ipa && (
          <span className="flashcard-ipa font-mono text-indigo-400 mt-2 block select-all">
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
        <div className="flashcard-face-content flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-900">
          {config.imagePolicy === 'answer' && (
            <VocabItemImage item={currentItem} revealAnswer theme="dark" />
          )}
          <div>
            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold rounded uppercase tracking-wider">
              {currentItem.pos}
            </span>
            <h2 data-flashcard-text-size={currentItem.term.length <= 18 ? 'short' : 'long'} className="flashcard-text font-black text-indigo-400 mt-1 select-all">{currentItem.term}</h2>
            {currentItem.ipa && <p className="flashcard-ipa font-mono text-indigo-300">{currentItem.ipa}</p>}
          </div>
          <div className="border-t border-white/5 w-full pt-4">
            <h3 className="flashcard-meaning font-bold text-emerald-400 select-all">{currentItem.meaning}</h3>
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
      <div className="flashcard-face-content flex flex-col items-center justify-center p-6 text-center bg-slate-900">
        {config.imagePolicy === 'answer' && (
          <VocabItemImage item={currentItem} revealAnswer theme="dark" className="mb-3" />
        )}
        <h2 data-flashcard-text-size={value.length <= 18 ? 'short' : 'long'} className="flashcard-text font-black text-indigo-400 leading-tight select-all">
          {value}
        </h2>
        {config.back === 'term' && currentItem.ipa && (
          <span className="flashcard-ipa font-mono text-indigo-300 mt-2 block select-all">
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
      <div className="flashcard-progress-label flex items-center justify-between mb-4 px-2">
        <span className="text-sm font-semibold text-gray-500">
          Từ {currentIndex + 1} / {items.length}
        </span>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-indigo-600">{progressPercent}% Hoàn thành</span>
        </div>
      </div>

      <div className="flashcard-progress-track w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6" role="progressbar" aria-label="Tiến độ xem thẻ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
        <motion.div
          className="bg-indigo-600 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.3 }}
        />
      </div>

      {/* Main Flashcard Card Container */}
      <div className="flashcard-stage relative w-full perspective mb-8">
        <motion.div
          onClick={handleFlip}
          tabIndex={0}
          role="button"
          aria-label={isFlipped ? 'Lật về mặt trước' : 'Lật thẻ xem đáp án'}
          aria-pressed={isFlipped}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || event.repeat) return;
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              handleFlip();
            }
          }}
          className="flashcard-flipper relative w-full cursor-pointer transition-shadow duration-500 transform-style-3d rounded-3xl border border-white/10 shadow-xl hover:shadow-2xl"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeInOut" }}
          id="flashcard-card-flipper"
        >
          {/* Card Front */}
          <div 
            className="flashcard-face backface-hidden w-full bg-slate-900 border border-white/10 flex flex-col rounded-3xl overflow-hidden"
            aria-hidden={isFlipped}
            inert={isFlipped}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <div className="flashcard-face-header flex justify-between items-center px-6 py-4 text-gray-400 border-b border-white/5 text-xs">
              <span className="font-semibold uppercase tracking-wider text-indigo-400">MẶT TRƯỚC</span>
              <span>Bấm vào thẻ để lật xem đáp án</span>
            </div>
            <div className="flashcard-face-body flex-1 bg-transparent">
              {renderFront()}
            </div>
            <div className="flashcard-face-footer px-6 py-4 bg-white/5 text-center text-xs text-gray-400 border-t border-white/5">
              Nhấn phím SPACE hoặc bấm chuột để lật
            </div>
          </div>

          {/* Card Back */}
          <div 
            className="flashcard-face backface-hidden w-full bg-slate-900 border border-white/10 flex flex-col rounded-3xl overflow-hidden animate-none"
            aria-hidden={!isFlipped}
            inert={!isFlipped}
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              WebkitTransform: 'rotateY(180deg)'
            }}
          >
            <div className="flashcard-face-header flex justify-between items-center px-6 py-4 text-gray-400 border-b border-white/5 text-xs bg-slate-900">
              <span className="font-semibold uppercase tracking-wider text-emerald-400">MẶT SAU (ĐÁP ÁN)</span>
              <span>Bấm vào thẻ để lật lại</span>
            </div>
            <div className="flashcard-face-body flex-1 bg-slate-900">
              {renderBack()}
            </div>
            <div className="flashcard-face-footer px-6 py-4 bg-white/5 text-center text-xs text-gray-400 border-t border-white/5 bg-slate-900">
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
