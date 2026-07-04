import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Headphones,
  Mic,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { VocabItem } from '../../types';
import { speakEnglish } from '../../lib/game-engine/speech';
import GameControlPanel from './GameControlPanel';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

interface SpeakingAIGameProps {
  items: VocabItem[];
  config: {
    targetMode?: 'term' | 'example' | 'example_or_term';
    recognitionLang?: string;
  };
  onComplete: (score: number, correct: number, incorrect: number) => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  isRandomized: boolean;
  onToggleRandom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  studentId?: string;
  studentName?: string;
  vocabularySetId?: string;
  gameSessionId?: string;
  authToken?: string | null;
}

interface AttemptResult {
  wordId: string;
  targetText: string;
  recognizedText: string;
  score: number;
  correctWords: number;
  totalWords: number;
  attemptCount: number;
}

function getLearningAudioUrl(item: VocabItem): string | undefined {
  const source = item as any;
  return item.audioUrl || source.audio || source.audioUrl || source.sound || source.pronunciationAudio;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ') : [];
}

function calculateAttemptScore(targetText: string, recognizedText: string, responseMs: number) {
  const targetWords = tokenize(targetText);
  const recognizedWords = tokenize(recognizedText);
  const totalWords = Math.max(targetWords.length, 1);
  let correctWords = 0;

  targetWords.forEach((word, index) => {
    if (recognizedWords[index] === word) correctWords += 1;
  });

  const wordAccuracyScore = Math.round((correctWords / totalWords) * 60);
  const wordCountRatio = Math.min(recognizedWords.length / totalWords, 1);
  const wordCountScore = Math.round(wordCountRatio * 20);
  const speedScore = responseMs <= 8000 ? 10 : responseMs <= 15000 ? 6 : 3;
  const completionScore = recognizedWords.length > 0 ? 10 : 0;
  const score = Math.min(100, wordAccuracyScore + wordCountScore + speedScore + completionScore);

  return {
    score,
    correctWords,
    totalWords,
  };
}

export default function SpeakingAIGame({
  items,
  config,
  onComplete,
  isMuted,
  setIsMuted,
  isRandomized,
  onToggleRandom,
  isFullscreen,
  onToggleFullscreen,
  studentId,
  studentName,
  vocabularySetId,
  gameSessionId,
  authToken,
}: SpeakingAIGameProps) {
  const playableItems = useMemo(
    () => items.filter((item) => item.term?.trim() && item.meaning?.trim()),
    [items]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [browserError, setBrowserError] = useState('');
  const [lastResult, setLastResult] = useState<AttemptResult | null>(null);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [attemptResults, setAttemptResults] = useState<AttemptResult[]>([]);
  const recognitionRef = useRef<any>(null);
  const listenStartedAtRef = useRef(0);
  const completedRef = useRef(false);

  const currentItem = playableItems[currentIndex];
  const isSoundOn = !isMuted;
  const SpeechRecognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;
  const isSpeechSupported = Boolean(SpeechRecognition);

  const targetText = useMemo(() => {
    if (!currentItem) return '';
    if (config.targetMode === 'term') return currentItem.term;
    if (config.targetMode === 'example') return currentItem.example?.trim() || currentItem.term;
    return currentItem.example?.trim() || currentItem.term;
  }, [currentItem, config.targetMode]);

  useEffect(() => {
    setCurrentIndex(0);
    setRecognizedText('');
    setLastResult(null);
    setAttemptCounts({});
    setAttemptResults([]);
    completedRef.current = false;
  }, [items, config]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore browser cleanup errors.
        }
      }
    };
  }, []);

  const saveAttempt = async (result: AttemptResult) => {
    try {
      await fetch('/api/pronunciation-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          studentId: studentId || 'guest',
          studentName,
          vocabularySetId: vocabularySetId || '',
          wordId: result.wordId,
          targetText: result.targetText,
          recognizedText: result.recognizedText,
          score: result.score,
          correctWords: result.correctWords,
          totalWords: result.totalWords,
          attemptCount: result.attemptCount,
          gameSessionId,
        }),
      });
    } catch (err) {
      console.warn('Saving pronunciation attempt failed:', err);
    }
  };

  const playSample = () => {
    if (!currentItem || isMuted) return;

    const audioUrl = getLearningAudioUrl(currentItem);
    if (audioUrl && targetText.trim() === currentItem.term.trim()) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => speakEnglish(targetText));
      return;
    }

    speakEnglish(targetText);
  };

  const startListening = () => {
    if (!currentItem || !targetText.trim()) return;
    if (!isSpeechSupported) {
      setBrowserError('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome trên máy tính hoặc Android để luyện nói.');
      return;
    }

    setBrowserError('');
    setRecognizedText('');
    setLastResult(null);
    setIsListening(true);
    listenStartedAtRef.current = Date.now();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = config.recognitionLang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const responseMs = Date.now() - listenStartedAtRef.current;
      const scored = calculateAttemptScore(targetText, transcript, responseMs);
      const nextAttemptCount = (attemptCounts[currentItem.id] || 0) + 1;
      const result: AttemptResult = {
        wordId: currentItem.id,
        targetText,
        recognizedText: transcript,
        score: scored.score,
        correctWords: scored.correctWords,
        totalWords: scored.totalWords,
        attemptCount: nextAttemptCount,
      };

      setRecognizedText(transcript);
      setAttemptCounts((prev) => ({ ...prev, [currentItem.id]: nextAttemptCount }));
      setLastResult(result);
      setAttemptResults((prev) => {
        const withoutCurrent = prev.filter((item) => item.wordId !== currentItem.id);
        return [...withoutCurrent, result];
      });
      saveAttempt(result);
    };

    recognition.onerror = (event: any) => {
      const message = event?.error === 'no-speech'
        ? 'Hệ thống chưa nghe thấy giọng đọc. Em hãy thử lại và đọc rõ hơn nhé.'
        : 'Không nhận diện được giọng nói. Hãy kiểm tra micro và thử lại.';
      setBrowserError(message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setBrowserError('Micro đang bận hoặc trình duyệt chưa cho phép ghi âm. Hãy thử lại sau vài giây.');
      setIsListening(false);
    }
  };

  const retryCurrent = () => {
    setRecognizedText('');
    setLastResult(null);
    setBrowserError('');
  };

  const completeGame = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const attempted = attemptResults.length;
    const totalScore = attemptResults.reduce((sum, item) => sum + item.score, 0);
    const averageScore = attempted ? Math.round(totalScore / attempted) : 0;
    const correct = attemptResults.filter((item) => item.score >= 70).length;
    const incorrect = Math.max(playableItems.length - correct, 0);
    onComplete(averageScore, correct, incorrect);
  };

  const goNext = () => {
    if (!lastResult) return;

    setRecognizedText('');
    setLastResult(null);
    setBrowserError('');

    if (currentIndex >= playableItems.length - 1) {
      completeGame();
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  if (playableItems.length === 0) {
    return (
      <div className="rounded-3xl bg-slate-950 p-8 text-center border border-white/10 text-white">
        <AlertCircle className="mx-auto mb-3 text-amber-300" size={36} />
        <h3 className="text-xl font-black">Chưa có dữ liệu để luyện nói</h3>
        <p className="text-sm text-slate-300 mt-2">Bộ từ vựng cần có ít nhất từ tiếng Anh và nghĩa tiếng Việt.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-slate-950 text-white border border-white/10 overflow-hidden shadow-2xl">
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-sky-950 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-400/10 border border-sky-300/20 px-3 py-1 text-xs font-black text-sky-200 uppercase">
              <Mic size={14} />
              Luyện nói cùng AI
            </div>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight">Đọc theo mẫu và nhận điểm</h3>
            <p className="text-sm text-slate-300">Lượt {currentIndex + 1} / {playableItems.length}</p>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-center">
            <p className="text-[10px] uppercase font-black text-slate-300">Điểm lượt này</p>
            <p className="text-3xl font-black text-emerald-300">{lastResult ? lastResult.score : '--'}</p>
          </div>
        </div>

        {!isSpeechSupported && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 flex items-start gap-3 text-amber-100">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm font-semibold">
              Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome trên máy tính hoặc Android để luyện nói.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-5">
          <section className="rounded-3xl bg-white/10 border border-white/15 p-5 md:p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-xs uppercase font-black text-sky-200">Từ vựng</p>
              <div className="flex flex-wrap items-end gap-3">
                <h4 className="text-4xl md:text-5xl font-black text-white">{currentItem.term}</h4>
                {currentItem.ipa && (
                  <span className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-sm font-bold text-slate-200">
                    {currentItem.ipa}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-emerald-200">{currentItem.meaning}</p>
            </div>

            {currentItem.example && (
              <div className="rounded-2xl bg-slate-950/50 border border-white/10 p-4 space-y-2">
                <p className="text-xs uppercase font-black text-slate-400">Ví dụ</p>
                <p className="text-lg font-bold text-slate-50">{currentItem.example}</p>
                {currentItem.exampleMeaning && (
                  <p className="text-sm font-semibold text-slate-300">{currentItem.exampleMeaning}</p>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-indigo-500/15 border border-indigo-300/20 p-4">
              <p className="text-xs uppercase font-black text-indigo-200">Nội dung cần đọc</p>
              <p className="text-xl md:text-2xl font-black text-white mt-1">{targetText}</p>
            </div>
          </section>

          <section className="rounded-3xl bg-white/10 border border-white/15 p-5 md:p-6 space-y-4">
            <button
              type="button"
              onClick={playSample}
              disabled={isMuted}
              className="w-full rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-400 text-white font-black py-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/20"
            >
              <Headphones size={20} />
              Nghe mẫu
            </button>

            <button
              type="button"
              onClick={startListening}
              disabled={isListening || !isSpeechSupported}
              className={`w-full rounded-2xl font-black py-5 flex items-center justify-center gap-2 transition-all shadow-lg ${
                isListening
                  ? 'bg-rose-500 text-white shadow-rose-500/20 animate-pulse'
                  : 'bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-400 text-white shadow-indigo-500/20'
              }`}
            >
              <Mic size={22} />
              {isListening ? 'Đang nghe...' : 'Bấm để đọc'}
            </button>

            {browserError && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-300/20 p-3 text-sm font-semibold text-rose-100">
                {browserError}
              </div>
            )}

            <div className="rounded-2xl bg-slate-950/60 border border-white/10 p-4 min-h-28">
              <p className="text-xs uppercase font-black text-slate-400">Hệ thống nghe được</p>
              <p className="text-base font-bold text-white mt-2">
                {recognizedText || 'Chưa có kết quả. Hãy bấm đọc và cho phép dùng micro.'}
              </p>
            </div>

            {lastResult && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-emerald-400/10 border border-emerald-300/20 p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-200">Đúng từ</p>
                  <p className="text-xl font-black text-emerald-300">{lastResult.correctWords}/{lastResult.totalWords}</p>
                </div>
                <div className="rounded-2xl bg-sky-400/10 border border-sky-300/20 p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-sky-200">Lần thử</p>
                  <p className="text-xl font-black text-sky-300">{lastResult.attemptCount}</p>
                </div>
                <div className="rounded-2xl bg-amber-400/10 border border-amber-300/20 p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-amber-200">Điểm</p>
                  <p className="text-xl font-black text-amber-300">{lastResult.score}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={retryCurrent}
                className="rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 py-3 font-bold text-white flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Thử lại
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!lastResult}
                className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 py-3 font-bold text-white flex items-center justify-center gap-2"
              >
                {currentIndex >= playableItems.length - 1 ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}
                {currentIndex >= playableItems.length - 1 ? 'Hoàn thành' : 'Câu tiếp theo'}
              </button>
            </div>
          </section>
        </div>

        <div className="rounded-2xl bg-white/8 border border-white/10 p-4 flex items-start gap-3">
          <Sparkles className="text-sky-300 shrink-0 mt-0.5" size={18} />
          <p className="text-xs text-slate-300 leading-relaxed">
            Điểm gồm 60 điểm độ đúng từng từ, 20 điểm đọc đủ số từ, 10 điểm tốc độ phản hồi và 10 điểm hoàn thành lượt đọc.
          </p>
        </div>

        <GameControlPanel
          currentIndex={currentIndex}
          totalItems={playableItems.length}
          onPrev={() => {
            setCurrentIndex((prev) => Math.max(0, prev - 1));
            retryCurrent();
          }}
          onNext={goNext}
          onPlaySound={playSample}
          isRandomized={isRandomized}
          onToggleRandom={onToggleRandom}
          isSoundOn={isSoundOn}
          onToggleSound={() => setIsMuted(!isMuted)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
      </div>
    </div>
  );
}
