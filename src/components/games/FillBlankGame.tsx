import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Check, X, ArrowRight, HelpCircle, Info } from 'lucide-react';
import { VocabItem } from '../../types';
import { speakEnglish } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';

interface FillBlankGameProps {
  items: VocabItem[];
  config: {
    mode: 'complete' | 'missing_letters';
    promptType: 'meaning' | 'meaning_and_hint';
  };
  onComplete: (score: number, correct: number, incorrect: number) => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export default function FillBlankGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
}: FillBlankGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const currentItem = items[currentIndex];

  const isSoundOn = !isMuted;

  useEffect(() => {
    // Reset state on config/items change
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setUserInput('');
    setIsSubmitted(false);
    setShowHint(false);
  }, [items, config]);

  useEffect(() => {
    // Focus the input box on question transition
    if (inputRef.current) {
      inputRef.current.focus();
    }
    setUserInput('');
    setIsSubmitted(false);
    setShowHint(false);
  }, [currentIndex]);

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100" id="fill-empty">
        <p>Không có từ vựng nào để thực hiện bài điền từ.</p>
      </div>
    );
  }

  // Get the target word for evaluation
  const targetWord = currentItem.term.trim();

  // Generate missing letters display for 'missing_letters' mode
  const getMissingLettersHint = () => {
    const word = targetWord;
    if (word.length <= 2) return word[0] + '_';
    
    // Hide roughly 40% of characters (but always leave first and last visible if possible)
    let output = '';
    for (let i = 0; i < word.length; i++) {
      if (i === 0 || i === word.length - 1 || word[i] === ' ') {
        output += word[i];
      } else {
        // Pseudo-random hiding based on char code index
        const hide = (word.charCodeAt(i) + i) % 3 === 0;
        output += hide ? '_' : word[i];
      }
    }
    
    // Fallback if no letters got hidden
    if (!output.includes('_')) {
      const idx = Math.floor(word.length / 2);
      return word.substring(0, idx) + '_' + word.substring(idx + 1);
    }

    return output;
  };

  const formattedHintWord = getMissingLettersHint();

  const handlePlaySound = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    speakEnglish(targetWord);
  };

  const handleCheckAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitted || !userInput.trim()) return;

    const cleanInput = userInput.trim().toLowerCase();
    const cleanTarget = targetWord.toLowerCase();

    const matched = cleanInput === cleanTarget;
    setIsCorrect(matched);
    setIsSubmitted(true);

    if (matched) {
      setCorrectCount(prev => prev + 1);
      if (isSoundOn) {
        speakEnglish(targetWord);
      }
    } else {
      setIncorrectCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      const total = items.length;
      const score = Math.round((correctCount / total) * 100);
      onComplete(score, correctCount, incorrectCount);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const progressPercent = Math.round((currentIndex / items.length) * 100);

  return (
    <div className="w-full max-w-lg mx-auto" id="fillblank-game-root">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-sm font-semibold text-gray-500">
          Câu hỏi {currentIndex + 1} / {items.length}
        </span>
        <div className="flex space-x-3 text-xs font-bold">
          <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Check size={12} /> {correctCount} Đúng
          </span>
          <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full flex items-center gap-1">
            <X size={12} /> {incorrectCount} Sai
          </span>
        </div>
      </div>

      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-6">
        <motion.div
          className="bg-indigo-600 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main Question Box */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl mb-6 relative overflow-hidden" id="fill-question-card">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/60 rounded-full blur-xl" />
        
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            {config.mode === 'missing_letters' ? 'ĐIỀN CHỮ CÒN THIẾU' : 'VIẾT TỪ TIẾNG ANH'}
          </span>

          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 leading-tight">
              {currentItem.meaning}
            </h2>
            <p className="text-xs text-gray-400 font-semibold uppercase">{currentItem.pos}</p>
          </div>

          {config.mode === 'missing_letters' && (
            <div className="bg-gray-50 border border-gray-100 px-6 py-3 rounded-2xl font-mono text-2xl md:text-3xl tracking-widest text-indigo-600 font-bold select-none">
              {formattedHintWord.split('').map((char, index) => (
                <span 
                  key={index} 
                  className={char === '_' ? 'text-amber-500 border-b-2 border-amber-500 mx-0.5 animate-pulse' : 'mx-0.5'}
                >
                  {char}
                </span>
              ))}
            </div>
          )}

          {currentItem.example && (
            <div className="text-sm bg-indigo-50/30 border border-indigo-50 px-4 py-2.5 rounded-xl text-gray-500 italic max-w-sm">
              “{currentItem.example.replace(new RegExp(currentItem.term, 'gi'), '_____')}”
            </div>
          )}
        </div>
      </div>

      {/* Input Form Area */}
      <form onSubmit={handleCheckAnswer} className="space-y-4" id="fill-form">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isSubmitted}
            placeholder={
              config.mode === 'missing_letters' 
                ? `Nhập từ đầy đủ (${targetWord.length} chữ cái)` 
                : "Gõ từ tiếng Anh vào đây..."
            }
            className={`w-full p-5 px-6 pr-12 text-center text-xl font-bold bg-white border-2 rounded-2xl shadow-sm transition-all outline-none ${
              isSubmitted
                ? isCorrect
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-rose-300 bg-rose-50 text-rose-800"
                : "border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            }`}
            id="fill-blank-input-box"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />

          {!isSubmitted && (
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 text-gray-400 hover:text-indigo-600 rounded-lg transition-all cursor-pointer"
              title="Gợi ý chữ cái"
              id="hint-trigger"
            >
              <Info size={20} />
            </button>
          )}
        </div>

        {/* Dynamic Hints */}
        <AnimatePresence>
          {showHint && !isSubmitted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold rounded-xl flex items-center space-x-2"
              id="hint-box"
            >
              <HelpCircle size={16} className="text-amber-600 shrink-0" />
              <span>
                Gợi ý: Từ có <strong>{targetWord.length}</strong> chữ cái. Bắt đầu bằng chữ <strong>"{targetWord[0].toUpperCase()}"</strong>.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        {!isSubmitted ? (
          <button
            type="submit"
            disabled={!userInput.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-lg rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
            id="submit-answer-btn"
          >
            <span>KIỂM TRA ĐÁP ÁN</span>
            <ArrowRight size={20} />
          </button>
        ) : null}
      </form>

      {/* Answer Feedback Panel */}
      <AnimatePresence>
        {isSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md mt-4 ${
              isCorrect
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}
            id="fill-feedback-box"
          >
            <div className="flex items-start space-x-3">
              <div className="mt-0.5 shrink-0">
                {isCorrect ? (
                  <Check className="w-6 h-6 bg-emerald-500 text-white rounded-full p-1" />
                ) : (
                  <X className="w-6 h-6 bg-rose-500 text-white rounded-full p-1" />
                )}
              </div>
              <div>
                <p className="font-extrabold text-base">
                  {isCorrect ? "Hoàn toàn chính xác!" : "Hơi tiếc một chút!"}
                </p>
                <p className="text-sm opacity-90 mt-0.5">
                  Đáp án đúng: <strong className="text-base font-mono underline">{targetWord}</strong>
                  {currentItem.ipa && <span className="font-mono text-xs opacity-75 ml-2">[{currentItem.ipa}]</span>}
                </p>
                {currentItem.example && (
                  <p className="text-xs italic opacity-75 mt-2 border-t border-current/10 pt-1.5">
                    💡 Ví dụ: {currentItem.example} ({currentItem.exampleMeaning})
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
              <button
                onClick={handlePlaySound}
                className="p-3 bg-white/80 hover:bg-white text-gray-700 rounded-xl transition-all cursor-pointer border border-current/10"
                title="Nghe phát âm"
              >
                <Volume2 size={20} />
              </button>
              <button
                onClick={handleNext}
                className={`py-3 px-6 rounded-xl font-bold tracking-wide shadow-md transition-all text-white cursor-pointer active:scale-95 ${
                  isCorrect
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-100"
                }`}
                id="continue-fillblank-btn"
              >
                {currentIndex < items.length - 1 ? "TIẾP THEO" : "XEM KẾT QUẢ"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Slider Controls */}
      <GameControlPanel
        currentIndex={currentIndex}
        totalItems={items.length}
        onPrev={handlePrev}
        onNext={isSubmitted ? handleNext : () => {}}
        onPlaySound={handlePlaySound}
        isRandomized={isRandomized}
        onToggleRandom={onToggleRandom}
        isSoundOn={isSoundOn}
        onToggleSound={() => setIsMuted(prev => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  );
}
