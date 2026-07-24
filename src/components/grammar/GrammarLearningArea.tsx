import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, FileText, XCircle } from 'lucide-react';
import { GrammarAttempt, GrammarSet } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { STUDENT_NAME_MAX_LENGTH, validateStudentDisplayName } from '../../lib/studentIdentity';
import { identifyExistingGuest } from '../../lib/guestIdentity';

interface GrammarLearningAreaProps {
  grammarSet: GrammarSet;
  accessToken?: string;
  onBack: () => void;
}

interface GrammarQuestionFeedback {
  isCorrect: boolean;
  correctOptionId?: string;
  correctAnswer?: string;
  explanation?: string;
  scoreAwarded: number;
}

type StudentIdentityStatus = 'checking' | 'ready' | 'needs_name';

const GUEST_ID_STORAGE_KEY = 'msdieu_guest_id';
const STUDENT_NAME_STORAGE_KEY = 'msdieu_student_name';
const GRAMMAR_ATTEMPT_TOKEN_STORAGE_KEY = 'msdieu_grammar_attempt_tokens';

function createGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStoredGuestId() {
  if (typeof window === 'undefined') return '';

  try {
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;

    const newGuestId = createGuestId();
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, newGuestId);
    return newGuestId;
  } catch {
    return createGuestId();
  }
}

function getStoredStudentName() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function getStoredAttemptTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GRAMMAR_ATTEMPT_TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredAttemptToken(attemptId: string) {
  return getStoredAttemptTokens()[attemptId] || '';
}

function storeAttemptToken(attemptId: string, attemptToken?: string) {
  if (!attemptId || !attemptToken || typeof window === 'undefined') return;
  try {
    const tokens = getStoredAttemptTokens();
    tokens[attemptId] = attemptToken;
    window.localStorage.setItem(GRAMMAR_ATTEMPT_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // If localStorage is unavailable, the token still exists in React state for the current session.
  }
}

function formatDuration(totalSeconds?: number) {
  const secs = Math.max(0, Math.round(totalSeconds || 0));
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}

function formatVietnamDateTime(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatGradeLabel(value?: string) {
  return (value || '').replace(/Lá»›p/g, 'Lớp');
}

export default function GrammarLearningArea({ grammarSet, accessToken, onBack }: GrammarLearningAreaProps) {
  const { token, user, loading: authLoading } = useAuth();
  const [attempts, setAttempts] = useState<GrammarAttempt[]>([]);
  const [attempt, setAttempt] = useState<GrammarAttempt | null>(null);
  const [review, setReview] = useState<GrammarAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<Record<string, GrammarQuestionFeedback>>({});
  const [savingQuestionIds, setSavingQuestionIds] = useState<Record<string, boolean>>({});
  const answerRequestsRef = useRef(new Set<string>());
  const attemptsAbortRef = useRef<AbortController | null>(null);
  const startAttemptAbortRef = useRef<AbortController | null>(null);
  const startAttemptInFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guestId] = useState(() => getStoredGuestId());
  const [studentName, setStudentName] = useState(() => user?.name || '');
  const [identityStatus, setIdentityStatus] = useState<StudentIdentityStatus>(() => user?.name ? 'ready' : 'checking');
  const nameSubmitted = identityStatus === 'ready';

  const grammarFetch = (url: string, options: RequestInit = {}) => {
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Guest-Id': guestId
    };

    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (accessToken) baseHeaders['X-Grammar-Share-Token'] = accessToken;

    return fetch(url, {
      ...options,
      headers: {
        ...baseHeaders,
        ...(options.headers as Record<string, string> | undefined)
      }
    });
  };

  const grammarUrlWithGuestQuery = (url: string, attemptToken = '') => {
    const params = new URLSearchParams();
    params.set('guestId', guestId);
    params.set('studentName', studentName.trim());
    if (accessToken) params.set('shareToken', accessToken);
    if (attemptToken) params.set('attemptToken', attemptToken);
    return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
  };

  useEffect(() => {
    if (authLoading) {
      setIdentityStatus('checking');
      return;
    }
    if (user?.name) {
      setStudentName(user.name);
      setIdentityStatus('ready');
      setError('');
      return;
    }

    const controller = new AbortController();
    setIdentityStatus('checking');
    identifyExistingGuest(guestId, controller.signal)
      .then(profile => {
        if (controller.signal.aborted) return;
        if (!profile) {
          const storedValidation = validateStudentDisplayName(getStoredStudentName());
          setStudentName(storedValidation.valid ? storedValidation.value : '');
          setIdentityStatus('needs_name');
          return;
        }

        setStudentName(profile.displayName);
        setIdentityStatus('ready');
        setError('');
        try {
          window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, profile.displayName);
        } catch {
          // The verified identity remains available in component state.
        }
      })
      .catch((err: any) => {
        if (controller.signal.aborted) return;
        setIdentityStatus('needs_name');
        setStudentName('');
        setError(err.message || 'Không thể xác minh hồ sơ học sinh.');
      });

    return () => controller.abort();
  }, [authLoading, guestId, user?.id, user?.name]);

  const persistStudentName = async (value: string) => {
    const validation = validateStudentDisplayName(value);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    let normalizedName = validation.value;
    if (!token) {
      try {
        const res = await grammarFetch('/api/guest-profiles/resolve', {
          method: 'POST',
          body: JSON.stringify({
            guestId,
            displayName: normalizedName,
            classId: grammarSet.classId,
            className: grammarSet.className || grammarSet.gradeLevel
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể lưu hồ sơ học sinh.');
        normalizedName = data.displayName || normalizedName;
      } catch (err: any) {
        setError(err.message || 'Không thể lưu hồ sơ học sinh.');
        return;
      }
    }

    try {
      window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, normalizedName);
      window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
    } catch {
      // localStorage may be unavailable in private browsing; guest headers still work for this session.
    }

    setStudentName(normalizedName);
    setIdentityStatus('ready');
    setError('');
  };

  const loadAttempts = async (force = false) => {
    if (!nameSubmitted || !studentName.trim()) return;
    if (!force && (attempt || review || startAttemptInFlightRef.current)) return;
    attemptsAbortRef.current?.abort();
    const controller = new AbortController();
    attemptsAbortRef.current = controller;
    try {
      const res = await grammarFetch(
        grammarUrlWithGuestQuery(`/api/grammar-sets/${grammarSet.id}/my-attempts`),
        { signal: controller.signal }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không tải được lịch sử làm bài.');
      setAttempts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (attemptsAbortRef.current === controller) attemptsAbortRef.current = null;
    }
  };

  useEffect(() => {
    if (attempt || review) return;
    const timer = window.setTimeout(() => {
      void loadAttempts();
    }, 600);
    return () => {
      window.clearTimeout(timer);
      attemptsAbortRef.current?.abort();
    };
  }, [token, grammarSet.id, identityStatus, studentName, guestId, accessToken, attempt?.id, review?.id]);

  useEffect(() => {
    return () => startAttemptAbortRef.current?.abort();
  }, []);

  const startAttempt = async () => {
    if (!nameSubmitted || !studentName.trim()) {
      setError('Vui lòng nhập tên học sinh để luyện ngữ pháp.');
      return;
    }
    if (startAttemptInFlightRef.current) return;

    startAttemptInFlightRef.current = true;
    attemptsAbortRef.current?.abort();
    startAttemptAbortRef.current?.abort();
    const controller = new AbortController();
    startAttemptAbortRef.current = controller;
    setLoading(true);
    setError('');
    setReview(null);
    try {
      const res = await grammarFetch(`/api/grammar-sets/${grammarSet.id}/attempts`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          guestId,
          studentName: studentName.trim(),
          shareToken: accessToken,
          classId: grammarSet.classId,
          className: grammarSet.className || grammarSet.gradeLevel
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không bắt đầu được bài luyện.');
      storeAttemptToken(data.id, data.attemptToken);
      setAttempt(data);
      setCurrentIndex(0);
      setSelectedOptions({});
      setTextAnswers({});
      setFeedbackByQuestion({});
      setSavingQuestionIds({});
      answerRequestsRef.current.clear();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err.message);
    } finally {
      startAttemptInFlightRef.current = false;
      if (startAttemptAbortRef.current === controller) startAttemptAbortRef.current = null;
      setLoading(false);
    }
  };

  const answerQuestion = async (attemptQuestionId: string, selectedOptionId: string) => {
    if (!attempt) return;
    if (feedbackByQuestion[attemptQuestionId] || answerRequestsRef.current.has(attemptQuestionId)) return;

    const previousSelectedOptionId = selectedOptions[attemptQuestionId];
    answerRequestsRef.current.add(attemptQuestionId);
    setSavingQuestionIds(prev => ({ ...prev, [attemptQuestionId]: true }));
    setSelectedOptions(prev => ({ ...prev, [attemptQuestionId]: selectedOptionId }));
    setError('');
    try {
      const res = await grammarFetch(`/api/grammar-attempts/${attempt.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({
          attemptQuestionId,
          selectedOptionId,
          guestId,
          studentName: studentName.trim(),
          shareToken: accessToken,
          attemptToken: attempt.attemptToken || getStoredAttemptToken(attempt.id)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không lưu được đáp án.');
      setAttempt(prev => prev ? {
        ...prev,
        answers: [...(prev.answers || []).filter(answer => answer.attemptQuestionId !== attemptQuestionId), data.answer]
      } : prev);
      if (data.feedback) {
        setFeedbackByQuestion(prev => ({ ...prev, [attemptQuestionId]: data.feedback }));
      }
    } catch (err: any) {
      setSelectedOptions(prev => {
        if (prev[attemptQuestionId] !== selectedOptionId) return prev;
        const next = { ...prev };
        if (previousSelectedOptionId) {
          next[attemptQuestionId] = previousSelectedOptionId;
        } else {
          delete next[attemptQuestionId];
        }
        return next;
      });
      setError(err.message);
    } finally {
      answerRequestsRef.current.delete(attemptQuestionId);
      setSavingQuestionIds(prev => {
        const next = { ...prev };
        delete next[attemptQuestionId];
        return next;
      });
    }
  };

  const answerRewriteQuestion = async (attemptQuestionId: string) => {
    if (!attempt) return;
    if (feedbackByQuestion[attemptQuestionId] || answerRequestsRef.current.has(attemptQuestionId)) return;

    const textAnswer = (textAnswers[attemptQuestionId] || '').trim();
    if (!textAnswer) {
      setError('Vui lòng nhập câu trả lời.');
      return;
    }

    answerRequestsRef.current.add(attemptQuestionId);
    setSavingQuestionIds(prev => ({ ...prev, [attemptQuestionId]: true }));
    setError('');
    try {
      const res = await grammarFetch(`/api/grammar-attempts/${attempt.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({
          attemptQuestionId,
          textAnswer,
          guestId,
          studentName: studentName.trim(),
          shareToken: accessToken,
          attemptToken: attempt.attemptToken || getStoredAttemptToken(attempt.id)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không lưu được câu trả lời.');
      setAttempt(prev => prev ? {
        ...prev,
        answers: [...(prev.answers || []).filter(answer => answer.attemptQuestionId !== attemptQuestionId), data.answer]
      } : prev);
      setTextAnswers(prev => ({ ...prev, [attemptQuestionId]: data.answer?.textAnswer || textAnswer }));
      if (data.feedback) {
        setFeedbackByQuestion(prev => ({ ...prev, [attemptQuestionId]: data.feedback }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      answerRequestsRef.current.delete(attemptQuestionId);
      setSavingQuestionIds(prev => {
        const next = { ...prev };
        delete next[attemptQuestionId];
        return next;
      });
    }
  };

  const submitAttempt = async () => {
    if (!attempt) return;
    setLoading(true);
    setError('');
    try {
      const res = await grammarFetch(`/api/grammar-attempts/${attempt.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          guestId,
          studentName: studentName.trim(),
          shareToken: accessToken,
          attemptToken: attempt.attemptToken || getStoredAttemptToken(attempt.id)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không nộp được bài.');
      setAttempt(null);
      setReview(data);
      await loadAttempts(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (attemptId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await grammarFetch(grammarUrlWithGuestQuery(`/api/grammar-attempts/${attemptId}/review`, getStoredAttemptToken(attemptId)));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không mở được bài làm.');
      setReview(data);
      setAttempt(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = attempt?.questions?.[currentIndex];
  const answeredCount = attempt ? attempt.answers.length : 0;
  const currentQuestionFeedback = currentQuestion ? feedbackByQuestion[currentQuestion.id] : undefined;
  const currentQuestionIsSaving = currentQuestion ? Boolean(savingQuestionIds[currentQuestion.id]) : false;
  const currentQuestionIsRewrite = Boolean(
    currentQuestion && (currentQuestion.questionType === 'rewrite' || grammarSet.questionType === 'rewrite')
  );
  const currentQuestionHasSavedAnswer = Boolean(
    currentQuestion && attempt?.answers.some(answer => answer.attemptQuestionId === currentQuestion.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={onBack} className="px-4 py-2 rounded-xl !border !border-blue-700 !bg-blue-600 hover:!bg-blue-700 !text-white text-sm font-bold flex items-center gap-2 shadow-sm">
            <ArrowLeft size={16} />
            Thoát ra
          </button>
          <div className="text-center min-w-0">
            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Luyện ngữ pháp</p>
            <h1 className="font-black text-gray-900 truncate">{grammarSet.title}</h1>
          </div>
          <div className="text-xs font-bold text-gray-500">{user?.name || studentName || 'Học sinh'}</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 py-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
        )}

        {identityStatus === 'checking' && !attempt && !review && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center">
            <p className="text-sm font-bold text-gray-600">Đang kiểm tra hồ sơ học sinh...</p>
          </div>
        )}

        {identityStatus === 'needs_name' && !attempt && !review && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6" id="grammar-name-prompt-container">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <BookOpen size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-800">Bắt đầu luyện ngữ pháp!</h2>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Hãy nhập tên của em để lưu điểm, xem lại bài làm và theo dõi kết quả học tập.
              </p>
            </div>

            <div className="max-w-sm mx-auto flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nhập họ và tên của em..."
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  maxLength={STUDENT_NAME_MAX_LENGTH}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') persistStudentName(studentName);
                }}
                className="flex-1 p-4 border-2 border-gray-200 rounded-2xl font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center text-lg"
                id="grammar-student-name-input"
              />
              <button
                onClick={() => persistStudentName(studentName)}
                disabled={!studentName.trim()}
                className="py-4 px-8 !bg-blue-600 hover:!bg-blue-700 disabled:!bg-gray-200 disabled:!text-gray-500 !text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer text-lg whitespace-nowrap"
                id="grammar-submit-name-btn"
              >
                Bắt đầu học
              </button>
            </div>
          </div>
        )}

        {nameSubmitted && !attempt && !review && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{grammarSet.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{grammarSet.description}</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black">
                {grammarSet.questions?.length || 0} câu
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold">Lớp: {formatGradeLabel(grammarSet.gradeLevel)}</div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold">Chủ đề: {grammarSet.topic || grammarSet.subject}</div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold flex items-center gap-2">
                <Clock size={16} /> {grammarSet.timeLimitMinutes ? `${grammarSet.timeLimitMinutes} phút` : 'Không giới hạn'}
              </div>
            </div>
            <button
              onClick={startAttempt}
              disabled={loading}
              className="w-full py-4 rounded-2xl !bg-blue-600 hover:!bg-blue-700 disabled:!bg-blue-300 !text-white !border !border-blue-700 disabled:!border-blue-300 font-black shadow-md transition-all"
            >
              {loading ? 'Đang tạo lượt làm...' : 'Bắt đầu làm bài'}
            </button>
          </div>
        )}

        {attempt && currentQuestion && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-gray-700">Câu {currentIndex + 1}/{attempt.questions.length}</span>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
                Đã trả lời {answeredCount}/{attempt.questions.length}
              </span>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-xl font-black text-gray-900">{currentQuestion.questionSnapshot}</p>
            </div>
            {currentQuestionIsRewrite ? (
              <div className="space-y-3">
                <textarea
                  value={textAnswers[currentQuestion.id] || ''}
                  onChange={event => setTextAnswers(prev => ({ ...prev, [currentQuestion.id]: event.target.value }))}
                  disabled={currentQuestionIsSaving || Boolean(currentQuestionFeedback)}
                  className="min-h-36 w-full rounded-2xl border-2 border-blue-200 bg-white p-4 text-base font-bold text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-50"
                  placeholder="Nhập câu trả lời của em..."
                />
                <button
                  onClick={() => answerRewriteQuestion(currentQuestion.id)}
                  disabled={currentQuestionIsSaving || Boolean(currentQuestionFeedback) || !(textAnswers[currentQuestion.id] || '').trim()}
                  className="w-full rounded-2xl !border !border-blue-700 !bg-blue-600 px-5 py-3 font-black !text-white shadow-sm hover:!bg-blue-700 disabled:!border-gray-300 disabled:!bg-gray-200 disabled:!text-gray-500"
                >
                  {currentQuestionIsSaving
                    ? 'Đang lưu câu trả lời...'
                    : currentQuestionHasSavedAnswer ? 'Cập nhật câu trả lời' : 'Trả lời'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.optionsSnapshot.map((option, index) => {
                  const selected = selectedOptions[currentQuestion.id] === option.id;
                  const isCorrectOption = currentQuestionFeedback?.correctOptionId === option.id;
                  const isWrongSelection = Boolean(currentQuestionFeedback && selected && !currentQuestionFeedback.isCorrect);
                  return (
                  <button
                    key={option.id}
                    onClick={() => answerQuestion(currentQuestion.id, option.id)}
                    disabled={currentQuestionIsSaving}
                    data-feedback-locked={currentQuestionFeedback ? 'true' : undefined}
                    className={`w-full rounded-2xl border p-4 text-left font-bold transition-all ${
                      isCorrectOption
                        ? '!bg-emerald-50 !border-emerald-500 !text-emerald-900 shadow-sm cursor-default'
                        : isWrongSelection
                          ? '!bg-rose-50 !border-rose-500 !text-rose-900 shadow-sm cursor-default'
                          : selected
                            ? '!bg-blue-600 !border-blue-700 !text-white shadow-sm'
                            : currentQuestionFeedback
                              ? '!bg-white !border-gray-200 !text-gray-700 cursor-default'
                              : '!bg-white !border-blue-300 hover:!bg-blue-50 hover:!border-blue-500 !text-gray-900'
                    }`}
                  >
                    <span className={`mr-3 inline-flex w-8 h-8 items-center justify-center rounded-xl border font-black ${
                      isCorrectOption
                        ? '!bg-emerald-100 !border-emerald-300 !text-emerald-800'
                        : isWrongSelection
                          ? '!bg-rose-100 !border-rose-300 !text-rose-800'
                          : selected
                            ? '!bg-white !border-white !text-blue-700'
                            : '!bg-blue-50 !border-blue-200 !text-blue-700'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option.text}
                    {isCorrectOption && <CheckCircle2 size={18} className="ml-3 inline-block align-middle" />}
                    {isWrongSelection && <XCircle size={18} className="ml-3 inline-block align-middle" />}
                  </button>
                  );
                })}
              </div>
            )}
            {currentQuestionIsSaving && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
                Đang lưu đáp án...
              </div>
            )}
            {currentQuestionFeedback && (
              <div className={`rounded-2xl border p-4 ${
                currentQuestionFeedback.isCorrect
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}>
                <div className="flex items-center gap-2 font-black">
                  {currentQuestionFeedback.isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  {currentQuestionFeedback.isCorrect ? 'Chính xác!' : 'Chưa chính xác.'}
                </div>
                {currentQuestionIsRewrite && currentQuestionFeedback.correctAnswer && (
                  <p className="mt-2 text-sm leading-relaxed">
                    <strong>Đáp án đúng:</strong> {currentQuestionFeedback.correctAnswer}
                  </p>
                )}
                {currentQuestionFeedback.explanation && (
                  <p className="mt-2 text-sm leading-relaxed">
                    <strong>Giải Thích:</strong> {currentQuestionFeedback.explanation}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0 || currentQuestionIsSaving}
                className="px-5 py-3 rounded-2xl !border !border-gray-300 !bg-white !text-gray-800 disabled:!bg-gray-100 disabled:!text-gray-500 disabled:opacity-100 font-bold"
              >
                Câu trước
              </button>
              {currentIndex < attempt.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  disabled={currentQuestionIsSaving || !currentQuestionHasSavedAnswer}
                  className="px-5 py-3 rounded-2xl !bg-blue-600 hover:!bg-blue-700 disabled:!bg-blue-300 disabled:!border-blue-300 !text-white !border !border-blue-700 font-black shadow-sm"
                >
                  Câu tiếp theo
                </button>
              ) : (
                <button onClick={submitAttempt} disabled={loading || currentQuestionIsSaving || !currentQuestionHasSavedAnswer} className="px-5 py-3 rounded-2xl !bg-emerald-600 hover:!bg-emerald-700 disabled:!bg-emerald-300 !text-white !border !border-emerald-700 font-black shadow-sm">
                  Nộp bài
                </button>
              )}
            </div>
          </div>
        )}

        {review && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">Xem lại bài làm</h2>
                <p className="text-sm font-semibold text-gray-500">Hoàn thành: {formatVietnamDateTime(review.completedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-blue-700">{review.score}/{review.maxScore}</p>
                <p className="text-xs font-bold text-gray-500">Đúng {review.correctCount} - Sai {review.wrongCount} - Bỏ trống {review.unansweredCount}</p>
              </div>
            </div>
            <div className="space-y-4">
              {review.questions.map((question, index) => {
                const answer = review.answers.find(item => item.attemptQuestionId === question.id);
                const isRewrite = question.questionType === 'rewrite' || grammarSet.questionType === 'rewrite';
                const canShowCorrectAnswers = Boolean(question.correctOptionId);
                return (
                  <div key={question.id} className="rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b border-gray-200">
                      <p className="text-sm font-black text-gray-900">Câu {index + 1}: {question.questionSnapshot}</p>
                    </div>
                    <div className="p-4 space-y-2">
                      {isRewrite ? (
                        <>
                          <div className={`rounded-xl border p-3 text-sm ${
                            typeof answer?.isCorrect !== 'boolean'
                              ? 'border-blue-200 bg-blue-50 text-blue-900'
                              : answer.isCorrect
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : 'border-rose-300 bg-rose-50 text-rose-900'
                          }`}>
                            <strong>Câu trả lời của em:</strong> {answer?.textAnswer || 'Chưa trả lời'}
                          </div>
                          {question.correctAnswerSnapshot && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                              <strong>Đáp án đúng:</strong> {question.correctAnswerSnapshot}
                            </div>
                          )}
                        </>
                      ) : question.optionsSnapshot.map(option => {
                        const isSelected = answer?.selectedOptionId === option.id;
                        const isCorrect = canShowCorrectAnswers && question.correctOptionId === option.id;
                        return (
                          <div key={option.id} className={`rounded-xl border px-3 py-2 text-sm font-bold flex items-center justify-between ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : isSelected
                                ? canShowCorrectAnswers
                                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                                  : 'bg-blue-50 border-blue-300 text-blue-900'
                                : 'bg-white border-gray-200 text-gray-700'
                          }`}>
                            <span>{option.text}</span>
                            {isCorrect && <CheckCircle2 size={16} />}
                            {isSelected && !isCorrect && canShowCorrectAnswers && <XCircle size={16} />}
                          </div>
                        );
                      })}
                      {question.explanationSnapshot && (
                      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900">
                        <strong>Giải Thích:</strong> {question.explanationSnapshot}
                      </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setReview(null)} className="w-full py-3 rounded-2xl !bg-gray-900 !text-white font-black">
              Quay lại danh sách
            </button>
          </div>
        )}

        {!attempt && !review && attempts.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-gray-900 flex items-center gap-2"><FileText size={18} /> Lịch sử làm bài</h3>
            <div className="space-y-2">
              {attempts.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => item.status === 'completed' && openReview(item.id)}
                  className="w-full rounded-2xl !border !border-blue-200 !bg-blue-50 hover:!bg-blue-100 hover:!border-blue-400 p-4 text-left flex items-center justify-between gap-3"
                >
                  <span className="font-bold text-gray-900">Lần {attempts.length - index} - {item.score}/{item.maxScore} điểm - {formatVietnamDateTime(item.completedAt || item.createdAt)}</span>
                  <span className="text-xs font-black text-blue-700">{item.status === 'completed' ? 'Xem lại' : 'Đang làm'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
