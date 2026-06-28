import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Timer, Zap, CheckCircle2, ShieldCheck } from 'lucide-react';
import { VocabItem } from '../../types';
import { speakEnglish } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';

interface MatchingGameProps {
  items: VocabItem[];
  config: {
    matchType: 'term_to_meaning';
  };
  onComplete: (score: number, correct: number, incorrect: number) => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

interface MatchCard {
  id: string; // unique card id (e.g. itemID-term or itemID-meaning)
  itemId: string; // original item id
  text: string;
  type: 'term' | 'meaning';
}

export default function MatchingGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
}: MatchingGameProps) {
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [matchedItemIds, setMatchedItemIds] = useState<Set<string>>(new Set());
  const [failedCardIds, setFailedCardIds] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and shuffle cards
  const initGame = () => {
    if (!items || items.length === 0) return;

    // Standardize to at most 8 items to keep game screen playable and high-performing on mobile
    const gameItems = items.slice(0, 8);

    const termCards: MatchCard[] = gameItems.map(item => ({
      id: `${item.id}-term`,
      itemId: item.id,
      text: item.term,
      type: 'term'
    }));

    const meaningCards: MatchCard[] = gameItems.map(item => ({
      id: `${item.id}-meaning`,
      itemId: item.id,
      text: item.meaning,
      type: 'meaning'
    }));

    // Suffle together
    const combined = [...termCards, ...meaningCards].sort(() => Math.random() - 0.5);

    setCards(combined);
    setMatchedItemIds(new Set());
    setFailedCardIds(new Set());
    setSelectedCard(null);
    setAttempts(0);
    setMistakes(0);
    setTimeElapsed(0);
    setGameFinished(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items, config]);

  // Handle timer countdown
  useEffect(() => {
    if (isPlaying && !gameFinished) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, gameFinished]);

  // Handle game finished condition
  useEffect(() => {
    const activeItemsCount = Math.min(items.length, 8);
    if (matchedItemIds.size === activeItemsCount && activeItemsCount > 0 && !gameFinished) {
      setGameFinished(true);
      setIsPlaying(false);
      
      // Calculate score based on mistakes
      // Max score 100, deduct 5 points per mistake, floor at 50
      const score = Math.max(50, 100 - mistakes * 5);
      onComplete(score, activeItemsCount, mistakes);
    }
  }, [matchedItemIds, mistakes, items, gameFinished]);

  const handleCardClick = (card: MatchCard) => {
    if (!isPlaying || gameFinished) return;
    if (matchedItemIds.has(card.itemId)) return;

    // Prevent double clicking same card
    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
      return;
    }

    // Play English pronunciation if term clicked and sound is on
    if (card.type === 'term' && !isMuted) {
      speakEnglish(card.text);
    }

    if (!selectedCard) {
      // First card selection
      setSelectedCard(card);
    } else {
      // Second card selection - verify pair
      setAttempts(prev => prev + 1);

      const isPair = selectedCard.itemId === card.itemId && selectedCard.type !== card.type;

      if (isPair) {
        // Matched successfully
        setMatchedItemIds(prev => {
          const next = new Set(prev);
          next.add(card.itemId);
          return next;
        });
        setSelectedCard(null);
      } else {
        // Match failed
        setMistakes(prev => prev + 1);
        setFailedCardIds(new Set([selectedCard.id, card.id]));
        setSelectedCard(null);

        // Flash error then clear selection after short delay
        setTimeout(() => {
          setFailedCardIds(new Set());
        }, 800);
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100" id="matching-empty">
        <p>Không có đủ từ vựng để tạo game ghép đôi.</p>
      </div>
    );
  }

  const activeCount = Math.min(items.length, 8);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6" id="matching-game-root">
      {/* Game Stats Header */}
      <div className="bg-white rounded-2xl p-4 px-6 border border-gray-100 shadow-sm flex items-center justify-between" id="matching-stats-bar">
        <div className="flex items-center space-x-2 text-gray-600">
          <Timer size={18} className="text-indigo-600" />
          <span className="font-mono font-bold text-sm md:text-base">{formatTime(timeElapsed)}</span>
        </div>
        
        <div className="text-xs bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1.5 rounded-full uppercase">
          GHÉP CẶP TỪ & NGHĨA ({matchedItemIds.size}/{activeCount})
        </div>

        <div className="flex items-center space-x-2 text-gray-600">
          <Zap size={18} className="text-amber-500" />
          <span className="text-xs font-bold md:text-sm">Lỗi: {mistakes}</span>
        </div>
      </div>

      {/* Grid Canvas */}
      {!gameFinished ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" id="matching-grid-container">
          <AnimatePresence>
            {cards.map(card => {
              const isMatched = matchedItemIds.has(card.itemId);
              const isSelected = selectedCard?.id === card.id;
              const isFailed = failedCardIds.has(card.id);

              let borderStyle = "border-gray-200 bg-white hover:border-indigo-400 hover:shadow-md text-gray-800";
              
              if (isSelected) {
                borderStyle = "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100 text-indigo-900 font-bold scale-102";
              } else if (isFailed) {
                borderStyle = "border-rose-400 bg-rose-50 text-rose-800 animate-shake";
              } else if (isMatched) {
                borderStyle = "border-emerald-200 bg-emerald-50 text-emerald-800 font-medium opacity-0 pointer-events-none scale-90";
              }

              return (
                <motion.button
                  key={card.id}
                  layout
                  onClick={() => handleCardClick(card)}
                  disabled={isMatched}
                  className={`h-24 p-3 border-2 rounded-2xl flex items-center justify-center text-center text-sm md:text-base font-semibold shadow-sm transition-all duration-300 transform select-none cursor-pointer overflow-hidden leading-snug break-words ${borderStyle}`}
                  whileHover={!isMatched && !isSelected ? { y: -2 } : {}}
                  whileTap={!isMatched ? { scale: 0.96 } : {}}
                  exit={{ scale: 0.8, opacity: 0 }}
                  id={`match-card-${card.id}`}
                >
                  <span className="line-clamp-3">{card.text}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* Finished State Screen */
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6 flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <ShieldCheck size={48} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-800">Hoàn thành ghép cặp!</h2>
            <p className="text-gray-500 text-sm max-w-sm">
              Bạn đã hoàn thành ghép đôi bộ từ vựng xuất sắc trong <strong className="text-indigo-600">{formatTime(timeElapsed)}</strong> với <strong className="text-amber-600">{mistakes}</strong> lỗi ghép sai.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 px-8 flex justify-around w-full max-w-md border border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ĐIỂM SỐ</p>
              <p className="text-2xl font-black text-emerald-600">{Math.max(50, 100 - mistakes * 5)}</p>
            </div>
            <div className="border-r border-gray-200" />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">LƯỢT GHÉP</p>
              <p className="text-2xl font-black text-indigo-600">{attempts}</p>
            </div>
          </div>

          <button
            onClick={initGame}
            className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center space-x-2"
          >
            <RotateCcw size={18} />
            <span>Chơi lại màn này</span>
          </button>
        </div>
      )}

      {/* Shared Premium Controls (simplified for board games) */}
      <GameControlPanel
        isRandomized={isRandomized}
        onToggleRandom={onToggleRandom}
        isSoundOn={!isMuted}
        onToggleSound={() => setIsMuted(prev => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        showLinearControls={false}
      />
    </div>
  );
}
