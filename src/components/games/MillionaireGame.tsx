import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Headphones,
  HelpCircle,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { VocabItem } from '../../types';
import GameControlPanel from './GameControlPanel';

interface MillionaireGameProps {
  items: VocabItem[];
  config: {
    maxQuestions?: number;
    enableLifelines?: boolean;
  };
  onComplete: (score: number, correct: number, incorrect: number) => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

interface MillionaireQuestion {
  item: VocabItem;
  answers: string[];
  correctAnswer: string;
}

const PRIZE_LADDER = [
  100,
  200,
  300,
  500,
  1000,
  2000,
  4000,
  8000,
  16000,
  32000,
  64000,
  125000,
  250000,
  500000,
  1000000,
];

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

function shuffleList<T>(list: T[]): T[] {
  return [...list].sort(() => Math.random() - 0.5);
}

function getUniqueMeanings(items: VocabItem[]): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => item.meaning?.trim())
        .filter((meaning): meaning is string => Boolean(meaning))
    )
  );
}

function getImageUrl(item: VocabItem): string | undefined {
  const source = item as any;
  return source.imageUrl || source.image;
}

function getPhonetic(item: VocabItem): string | undefined {
  const source = item as any;
  return item.ipa || source.phonetic || source.phonetics || source.phienAm;
}

function getLearningAudioUrl(item: VocabItem): string | undefined {
  const source = item as any;
  return item.audioUrl || source.audio || source.sound || source.pronunciationAudio;
}

function formatPrize(value: number): string {
  return value.toLocaleString('en-US');
}

export default function MillionaireGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
}: MillionaireGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lockedAnswer, setLockedAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [removedAnswers, setRemovedAnswers] = useState<Set<string>>(new Set());
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedPhoneticHint, setUsedPhoneticHint] = useState(false);
  const [showPhoneticHint, setShowPhoneticHint] = useState(false);
  const completionRef = useRef(false);

  const maxQuestions = Math.min(config.maxQuestions || 15, PRIZE_LADDER.length);

  const questions = useMemo<MillionaireQuestion[]>(() => {
    const validItems = items.filter((item) => item.term?.trim() && item.meaning?.trim());
    const uniqueMeanings = getUniqueMeanings(validItems);

    if (uniqueMeanings.length < 4) {
      return [];
    }

    return shuffleList(validItems)
      .slice(0, maxQuestions)
      .map((item) => {
        const correctAnswer = item.meaning.trim();
        const distractors = shuffleList(
          uniqueMeanings.filter((meaning) => meaning !== correctAnswer)
        ).slice(0, 3);
        const answers = shuffleList([correctAnswer, ...distractors]);

        return {
          item,
          answers,
          correctAnswer,
        };
      })
      .filter((question) => question.answers.length === 4);
  }, [items, maxQuestions]);

  const currentQuestion = questions[currentIndex];
  const currentPrize = PRIZE_LADDER[currentIndex] || 0;
  const bankedPrize = correctCount > 0 ? PRIZE_LADDER[correctCount - 1] : 0;
  const phoneticHint = currentQuestion ? getPhonetic(currentQuestion.item) : undefined;
  const learningAudioUrl = currentQuestion ? getLearningAudioUrl(currentQuestion.item) : undefined;
  const imageUrl = currentQuestion ? getImageUrl(currentQuestion.item) : undefined;

  const playEffect = (name: string) => {
    if (isMuted || typeof Audio === 'undefined') return;

    try {
      const audio = new Audio(`/sounds/millionaire/${name}.mp3`);
      audio.volume = 0.45;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {});
      }
    } catch {
      // Sound assets are optional and must never break gameplay.
    }
  };

  const playLearningAudio = () => {
    if (isMuted || !learningAudioUrl) return;

    try {
      const audio = new Audio(learningAudioUrl);
      audio.volume = 0.8;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {});
      }
    } catch {
      // Optional learning audio can be missing or blocked by the browser.
    }
  };

  const finishGame = (score: number, correct: number, incorrect: number) => {
    if (completionRef.current) return;
    completionRef.current = true;
    setFinalScore(score);
    setGameFinished(true);
    onComplete(score, correct, incorrect);
  };

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setLockedAnswer(false);
    setRemovedAnswers(new Set());
    setShowPhoneticHint(false);
  };

  const handleSelectAnswer = (answer: string) => {
    if (!currentQuestion || lockedAnswer || removedAnswers.has(answer)) return;

    setSelectedAnswer(answer);
    setLockedAnswer(true);
    playEffect('select');

    const isCorrect = answer === currentQuestion.correctAnswer;

    window.setTimeout(() => {
      if (isCorrect) {
        const nextCorrectCount = correctCount + 1;
        const nextScore = PRIZE_LADDER[nextCorrectCount - 1] || currentPrize;
        playEffect(nextCorrectCount >= questions.length ? 'win' : 'correct');
        setCorrectCount(nextCorrectCount);

        window.setTimeout(() => {
          if (currentIndex >= questions.length - 1 || nextCorrectCount >= maxQuestions) {
            finishGame(nextScore, nextCorrectCount, incorrectCount);
          } else {
            setCurrentIndex((prev) => prev + 1);
            resetQuestionState();
            playEffect('next');
          }
        }, 900);
      } else {
        const nextIncorrectCount = incorrectCount + 1;
        setIncorrectCount(nextIncorrectCount);
        playEffect('wrong');

        window.setTimeout(() => {
          finishGame(bankedPrize, correctCount, nextIncorrectCount);
        }, 1200);
      }
    }, 650);
  };

  const handleFiftyFifty = () => {
    if (!currentQuestion || usedFiftyFifty || lockedAnswer) return;

    const wrongAnswers = currentQuestion.answers.filter(
      (answer) => answer !== currentQuestion.correctAnswer
    );
    const answersToRemove = shuffleList(wrongAnswers).slice(0, 2);
    setRemovedAnswers(new Set(answersToRemove));
    setUsedFiftyFifty(true);
    playEffect('suspense');
  };

  const handlePhoneticHint = () => {
    if (!phoneticHint || usedPhoneticHint || lockedAnswer) return;

    setShowPhoneticHint(true);
    setUsedPhoneticHint(true);
    playEffect('suspense');
  };

  const handleRestart = () => {
    completionRef.current = false;
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setGameFinished(false);
    setFinalScore(0);
    setUsedFiftyFifty(false);
    setUsedPhoneticHint(false);
    resetQuestionState();
    playEffect('start');
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-300 bg-slate-950 rounded-3xl border border-white/10">
        Bộ từ này chưa có dữ liệu để chơi Ai là triệu phú.
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-200 bg-slate-950 rounded-3xl border border-white/10 space-y-3">
        <h3 className="text-xl font-black text-white">Chưa đủ dữ liệu để tạo 4 đáp án</h3>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          Game cần ít nhất 4 từ vựng có nghĩa khác nhau. Hãy bổ sung thêm từ có đủ trường
          tiếng Anh và nghĩa tiếng Việt.
        </p>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-3xl border border-violet-300/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 md:p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-yellow-300/40 bg-yellow-300/10 text-yellow-200">
          <Sparkles size={42} />
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white">Kết thúc lượt chơi</h2>
        <p className="mt-3 text-sm text-slate-300">
          Bạn trả lời đúng {correctCount} câu và đạt {formatPrize(finalScore)} điểm.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <span className="block text-[10px] font-black uppercase text-slate-400">Điểm</span>
            <strong className="text-xl text-yellow-200">{formatPrize(finalScore)}</strong>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase text-slate-400">Đúng</span>
            <strong className="text-xl text-emerald-300">{correctCount}</strong>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase text-slate-400">Sai</span>
            <strong className="text-xl text-rose-300">{incorrectCount}</strong>
          </div>
        </div>
        <button
          onClick={handleRestart}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:bg-indigo-500 active:scale-95"
        >
          <RotateCcw size={18} />
          <span>Chơi lại</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto" id="millionaire-game-root">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 rounded-3xl border border-blue-300/20 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-4 md:p-6 shadow-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                English Millionaire
              </span>
              <h2 className="mt-1 text-2xl font-black text-white">Ai là triệu phú</h2>
            </div>
            <div className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-right">
              <span className="block text-[10px] font-black uppercase text-yellow-100/70">
                Câu {currentIndex + 1}/{questions.length}
              </span>
              <strong className="text-lg text-yellow-200">{formatPrize(currentPrize)}</strong>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleFiftyFifty}
              disabled={usedFiftyFifty || lockedAnswer}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              50:50
            </button>
            <button
              onClick={handlePhoneticHint}
              disabled={!phoneticHint || usedPhoneticHint || lockedAnswer}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              <HelpCircle size={14} />
              <span>Phiên âm</span>
            </button>
            <button
              onClick={playLearningAudio}
              disabled={!learningAudioUrl || isMuted || lockedAnswer}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              <Headphones size={14} />
              <span>Nghe phát âm</span>
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-5 md:p-7 text-center shadow-xl">
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="mx-auto mb-5 h-28 w-28 rounded-2xl object-cover border border-white/10"
                loading="lazy"
              />
            )}
            <p className="text-sm font-bold uppercase tracking-widest text-blue-200">
              What is the meaning of:
            </p>
            <h3 className="mt-3 text-4xl md:text-5xl font-black text-white leading-tight">
              {currentQuestion.item.term}
            </h3>
            <AnimatePresence>
              {showPhoneticHint && phoneticHint && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-3 font-mono text-lg text-yellow-200"
                >
                  {phoneticHint}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentQuestion.answers.map((answer, idx) => {
              const isSelected = selectedAnswer === answer;
              const isCorrect = answer === currentQuestion.correctAnswer;
              const isRemoved = removedAnswers.has(answer);
              let stateClass =
                'border-blue-300/20 bg-slate-900/70 text-white hover:border-yellow-300/60 hover:bg-blue-900/80';

              if (lockedAnswer && isCorrect) {
                stateClass = 'border-emerald-300 bg-emerald-500/20 text-emerald-100';
              } else if (lockedAnswer && isSelected && !isCorrect) {
                stateClass = 'border-rose-300 bg-rose-500/20 text-rose-100';
              } else if (isSelected) {
                stateClass = 'border-yellow-300 bg-yellow-300/20 text-yellow-100';
              } else if (isRemoved) {
                stateClass = 'border-white/5 bg-slate-900/30 text-slate-500 opacity-40';
              }

              return (
                <motion.button
                  key={`${idx}-${answer}`}
                  onClick={() => handleSelectAnswer(answer)}
                  disabled={lockedAnswer || isRemoved}
                  className={`min-h-20 rounded-2xl border-2 p-4 text-left transition-all cursor-pointer disabled:cursor-not-allowed ${stateClass}`}
                  whileHover={!lockedAnswer && !isRemoved ? { y: -2 } : {}}
                  whileTap={!lockedAnswer && !isRemoved ? { scale: 0.98 } : {}}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-300/40 bg-yellow-300/10 text-sm font-black text-yellow-200">
                      {ANSWER_LABELS[idx]}
                    </span>
                    <span className="text-sm md:text-base font-bold leading-snug">{answer}</span>
                    {lockedAnswer && isCorrect && <Check className="ml-auto text-emerald-300" size={18} />}
                    {lockedAnswer && isSelected && !isCorrect && <X className="ml-auto text-rose-300" size={18} />}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        <aside className="lg:col-span-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">
              Thang điểm
            </h3>
            <span className="text-xs font-bold text-yellow-200">{formatPrize(bankedPrize)}</span>
          </div>
          <div className="max-h-80 lg:max-h-[620px] overflow-y-auto pr-1 space-y-1.5">
            {[...PRIZE_LADDER].reverse().map((prize, reverseIdx) => {
              const level = PRIZE_LADDER.length - reverseIdx;
              const originalIdx = level - 1;
              const isCurrent = originalIdx === currentIndex;
              const isPassed = originalIdx < correctCount;
              const isSafety = level === 5 || level === 10 || level === 15;

              return (
                <div
                  key={prize}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                    isCurrent
                      ? 'border-yellow-300 bg-yellow-300/20 text-yellow-100'
                      : isPassed
                        ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/5 bg-white/5 text-slate-400'
                  }`}
                >
                  <span>{level}</span>
                  <span className={isSafety ? 'text-yellow-200' : ''}>{formatPrize(prize)}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <GameControlPanel
        isRandomized={isRandomized}
        onToggleRandom={onToggleRandom}
        isSoundOn={!isMuted}
        onToggleSound={() => setIsMuted((prev) => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        showLinearControls={false}
      />
    </div>
  );
}
