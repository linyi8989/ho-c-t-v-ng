import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Check, X, AlertCircle, Sparkles } from 'lucide-react';
import { VocabItem } from '../../types';
import { speakEnglish } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';

interface QuizGameProps {
  items: VocabItem[];
  config: {
    questionType: 'term' | 'meaning' | 'sound';
    answerType: 'term' | 'meaning';
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

export default function QuizGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
}: QuizGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const isSoundOn = !isMuted;
  const currentItem = items[currentIndex];

  // Set the correct answer depending on configuration
  const correctAnswer = currentItem 
    ? (config.answerType === 'term' ? currentItem.term : currentItem.meaning)
    : '';

  useEffect(() => {
    // Reset game parameters on item/config change
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setQuizFinished(false);
  }, [items, config]);

  // Generate randomized multi-choice options
  useEffect(() => {
    if (!currentItem) return;

    // Speak automatically if audio mode is active or autoPlay is enabled
    if (config.questionType === 'sound' || (config.autoPlaySound && isSoundOn)) {
      speakEnglish(currentItem.term);
    }

    const correctVal = config.answerType === 'term' ? currentItem.term : currentItem.meaning;
    
    // Extract distractors from the rest of the items list
    const pool = items
      .filter((item) => item.id !== currentItem.id)
      .map((item) => (config.answerType === 'term' ? item.term : item.meaning));
    
    // Unique list of options
    const uniquePool = Array.from(new Set(pool));
    
    // Shuffle the unique pool
    const shuffledPool = [...uniquePool].sort(() => 0.5 - Math.random());
    
    // Pick up to 3 distractors
    const distractors = shuffledPool.slice(0, 3);
    
    // Combine and shuffle correct option
    const finalOptions = [...distractors, correctVal].sort(() => 0.5 - Math.random());
    
    setOptions(finalOptions);
    setSelectedAnswer(null);
    setIsAnswered(false);
  }, [currentIndex, currentItem, config, items, isSoundOn]);

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100" id="quiz-empty">
        <p>Không có từ vựng nào để tạo trắc nghiệm.</p>
      </div>
    );
  }

  const handlePlaySound = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentItem) {
      speakEnglish(currentItem.term);
    }
  };

  const handleSelectAnswer = (option: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(option);
    setIsAnswered(true);

    const isCorrect = option === correctAnswer;
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      // Play a high pitched audio cue or speak the term
      if (isSoundOn) {
        speakEnglish(currentItem.term);
      }
    } else {
      setIncorrectCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Completed last question
      const total = items.length;
      const finalScore = Math.round((correctCount / total) * 100);
      onComplete(finalScore, correctCount, incorrectCount);
      setQuizFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const progressPercent = Math.round((currentIndex / items.length) * 100);

  return (
    <div className="w-full max-w-xl mx-auto" id="quiz-game-root">
      {/* Quiz Progress */}
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

      {/* Question Card Display */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl mb-6 relative overflow-hidden" id="quiz-question-card">
        {/* Decorative corner bg */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-2xl -mr-12 -mt-12" />

        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
            {config.questionType === 'sound' ? 'NGHE PHÁT ÂM' : 'CHỌN ĐÁP ÁN ĐÚNG'}
          </span>

          {config.questionType === 'sound' ? (
            <div className="py-4">
              <button
                onClick={() => handlePlaySound()}
                className="p-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-200 cursor-pointer flex items-center justify-center"
                id="play-sound-btn"
              >
                <Volume2 size={36} className="animate-pulse" />
              </button>
              <p className="text-xs text-gray-400 font-medium mt-3">Click để nghe lại từ tiếng Anh</p>
            </div>
          ) : (
            <div className="py-4">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-tight">
                {config.questionType === 'term' ? currentItem.term : currentItem.meaning}
              </h2>
              {config.questionType === 'term' && currentItem.ipa && (
                <p className="text-md font-mono text-gray-400 mt-2">{currentItem.ipa}</p>
              )}
            </div>
          )}

          {/* If there is a helper tip and question is already answered */}
          {isAnswered && (config.questionType !== 'sound' && currentItem.ipa) && (
            <button
              onClick={() => handlePlaySound()}
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Volume2 size={14} />
              <span>Nghe phát âm</span>
            </button>
          )}
        </div>
      </div>

      {/* Answer Options Grid */}
      <div className="grid grid-cols-1 gap-3 mb-6" id="quiz-options-container">
        {options.map((option, idx) => {
          let optionStyle = "border-gray-100 bg-white hover:bg-gray-50 text-gray-700 hover:border-indigo-200";
          let icon = null;

          if (isAnswered) {
            if (option === correctAnswer) {
              // Highlight the correct option in green
              optionStyle = "border-emerald-300 bg-emerald-50 text-emerald-800 font-medium shadow-emerald-100";
              icon = <Check size={18} className="text-emerald-600 shrink-0" />;
            } else if (option === selectedAnswer) {
              // Highlight selected wrong answer in red
              optionStyle = "border-rose-300 bg-rose-50 text-rose-800 font-medium shadow-rose-100";
              icon = <X size={18} className="text-rose-600 shrink-0" />;
            } else {
              // Dim other options
              optionStyle = "border-gray-100 bg-gray-50/50 text-gray-400 opacity-60";
            }
          }

          return (
            <motion.button
              key={`${idx}-${option}`}
              onClick={() => handleSelectAnswer(option)}
              disabled={isAnswered}
              className={`flex items-center justify-between p-4 px-6 text-left border-2 rounded-2xl shadow-sm transition-all text-lg font-medium cursor-pointer ${optionStyle} active:scale-98`}
              whileHover={!isAnswered ? { x: 4 } : {}}
              id={`quiz-option-${idx}`}
            >
              <div className="flex items-center space-x-4">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border shrink-0 ${
                  isAnswered 
                    ? (option === correctAnswer ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-gray-100 text-gray-400')
                    : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="leading-tight">{option}</span>
              </div>
              {icon}
            </motion.button>
          );
        })}
      </div>

      {/* Feedback & Continue */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md ${
              selectedAnswer === correctAnswer
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}
            id="quiz-feedback-box"
          >
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">
                {selectedAnswer === correctAnswer ? (
                  <Sparkles className="text-emerald-600 animate-bounce" size={24} />
                ) : (
                  <AlertCircle className="text-rose-600 animate-pulse" size={24} />
                )}
              </div>
              <div>
                <p className="font-extrabold text-base">
                  {selectedAnswer === correctAnswer ? "Chính xác! Xuất sắc lắm." : "Chưa đúng rồi!"}
                </p>
                <p className="text-sm opacity-90 mt-0.5">
                  {selectedAnswer === correctAnswer 
                    ? `"${currentItem.term}" nghĩa là "${currentItem.meaning}"`
                    : `Đáp án đúng là: "${correctAnswer}"`
                  }
                </p>
                {currentItem.example && (
                  <p className="text-xs italic opacity-75 mt-1.5 border-t border-current/10 pt-1.5">
                    💡 Ví dụ: {currentItem.example} ({currentItem.exampleMeaning})
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleNext}
              className={`py-3 px-6 rounded-xl font-bold tracking-wide shadow-md transition-all whitespace-nowrap text-white cursor-pointer active:scale-95 ${
                selectedAnswer === correctAnswer
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-100"
              }`}
              id="continue-quiz-btn"
            >
              {currentIndex < items.length - 1 ? "TIẾP TỤC" : "XEM KẾT QUẢ"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Slider Controls */}
      <GameControlPanel
        currentIndex={currentIndex}
        totalItems={items.length}
        onPrev={handlePrev}
        onNext={isAnswered ? handleNext : () => {}}
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
