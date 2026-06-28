import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, HelpCircle, Trophy } from 'lucide-react';
import { VocabItem } from '../../types';
import { speakEnglish } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';

interface MemoryGameProps {
  items: VocabItem[];
  config: {
    gridSize?: 'small' | 'large';
  };
  onComplete: (score: number, correct: number, incorrect: number) => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

interface MemoryCard {
  id: string; // unique card id (e.g. `${itemId}-${type}`)
  itemId: string;
  text: string;
  type: 'term' | 'meaning';
  isFlipped: boolean;
  isMatched: boolean;
}

export default function MemoryGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
}: MemoryGameProps) {
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Determine active item count (usually 6 items = 12 cards for small screen, 8 items = 16 cards max)
  const activeItemsCount = Math.min(items.length, 6);

  const initGame = () => {
    if (!items || items.length === 0) return;

    // Pick subset of items
    const gameItems = items.slice(0, activeItemsCount);

    const termCards: MemoryCard[] = gameItems.map(item => ({
      id: `${item.id}-term`,
      itemId: item.id,
      text: item.term,
      type: 'term',
      isFlipped: false,
      isMatched: false
    }));

    const meaningCards: MemoryCard[] = gameItems.map(item => ({
      id: `${item.id}-meaning`,
      itemId: item.id,
      text: item.meaning,
      type: 'meaning',
      isFlipped: false,
      isMatched: false
    }));

    // Suffle combined array
    const combined = [...termCards, ...meaningCards].sort(() => Math.random() - 0.5);

    setCards(combined);
    setFlippedIndices([]);
    setMoves(0);
    setMatchesCount(0);
    setGameFinished(false);
    setIsLocked(false);
  };

  useEffect(() => {
    initGame();
  }, [items, config]);

  const handleCardClick = (clickedIdx: number) => {
    if (isLocked) return;
    
    const card = cards[clickedIdx];
    if (card.isFlipped || card.isMatched) return;

    // Pronounce word if term is flipped and sound is on
    if (card.type === 'term' && !isMuted) {
      speakEnglish(card.text);
    }

    // Flip card
    const nextCards = [...cards];
    nextCards[clickedIdx].isFlipped = true;
    setCards(nextCards);

    const nextFlipped = [...flippedIndices, clickedIdx];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves(prev => prev + 1);
      setIsLocked(true);

      const firstCard = cards[nextFlipped[0]];
      const secondCard = cards[nextFlipped[1]];

      const isMatch = firstCard.itemId === secondCard.itemId && firstCard.type !== secondCard.type;

      if (isMatch) {
        // Matched! Keep them open
        setTimeout(() => {
          const matchedCards = cards.map((c, i) => {
            if (i === nextFlipped[0] || i === nextFlipped[1]) {
              return { ...c, isMatched: true };
            }
            return c;
          });
          
          setCards(matchedCards);
          setFlippedIndices([]);
          setMatchesCount(prev => {
            const nextVal = prev + 1;
            // Check win condition
            if (nextVal === activeItemsCount) {
              setGameFinished(true);
              // Max score 100, reduce score as moves exceed perfect moves (activeItemsCount)
              const perfectMoves = activeItemsCount;
              const excessMoves = Math.max(0, moves + 1 - perfectMoves);
              const score = Math.max(50, 100 - excessMoves * 4);
              onComplete(score, activeItemsCount, moves + 1);
            }
            return nextVal;
          });
          setIsLocked(false);
        }, 600);
      } else {
        // Not a match, flip back
        setTimeout(() => {
          const resetCards = cards.map((c, i) => {
            if (i === nextFlipped[0] || i === nextFlipped[1]) {
              return { ...c, isFlipped: false };
            }
            return c;
          });
          setCards(resetCards);
          setFlippedIndices([]);
          setIsLocked(false);
        }, 1200);
      }
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100" id="memory-empty">
        <p>Không đủ từ vựng để tạo game lật thẻ nhớ.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6" id="memory-game-root">
      {/* Game Header Metrics */}
      <div className="flex items-center justify-between gap-4 mb-6 px-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm" id="memory-stats-bar">
        <div className="flex space-x-4 text-sm font-semibold text-gray-600">
          <span>Lượt đi: <strong className="text-indigo-600 text-base">{moves}</strong></span>
          <span>Đã ghép: <strong className="text-emerald-600 text-base">{matchesCount} / {activeItemsCount}</strong></span>
        </div>

        <button
          onClick={initGame}
          className="p-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
          id="restart-memory-btn"
        >
          <RefreshCw size={14} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Play Grid board */}
      {!gameFinished ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1" id="memory-grid-container">
          {cards.map((card, idx) => {
            const isRevealed = card.isFlipped || card.isMatched;

            return (
              <div 
                key={card.id} 
                className="h-28 relative cursor-pointer select-none perspective"
                onClick={() => handleCardClick(idx)}
              >
                <div 
                  className={`w-full h-full duration-500 transform-style-3d rounded-2xl border transition-all ${
                    isRevealed ? 'rotate-y-180' : ''
                  }`}
                  style={{ 
                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.5s'
                  }}
                >
                  {/* Face Down (Card Back) */}
                  <div 
                    className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400 text-white rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-all border-2"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <HelpCircle size={32} className="opacity-40 animate-pulse" />
                  </div>

                  {/* Face Up (Card Front) */}
                  <div 
                    className={`absolute inset-0 backface-hidden rounded-2xl flex items-center justify-center p-2.5 text-center text-sm font-bold border-2 leading-snug overflow-hidden bg-white ${
                      card.isMatched 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
                        : 'border-indigo-200 text-indigo-900 shadow-sm'
                    }`}
                    style={{ 
                      backfaceVisibility: 'hidden', 
                      transform: 'rotateY(180deg)'
                    }}
                  >
                    <span className="line-clamp-4">{card.text}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Game Finished State */
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6 flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
            <Trophy size={48} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-800">Trí nhớ tuyệt vời!</h2>
            <p className="text-gray-500 text-sm max-w-sm">
              Bạn đã lật trúng tất cả các thẻ từ vựng với <strong className="text-indigo-600">{moves} lượt mở bài</strong>.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 px-8 flex justify-around w-full max-w-md border border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ĐIỂM SỐ</p>
              <p className="text-2xl font-black text-emerald-600">{Math.max(50, 100 - Math.max(0, moves - activeItemsCount) * 4)}</p>
            </div>
            <div className="border-r border-gray-200" />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SỐ LẦN LẬT</p>
              <p className="text-2xl font-black text-indigo-600">{moves}</p>
            </div>
          </div>

          <button
            onClick={initGame}
            className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center space-x-2"
          >
            <RefreshCw size={18} />
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
