import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Volume2, Shuffle, Maximize2, ShieldAlert, Check, X, 
  HelpCircle, Trophy, BookOpen, Star, Sparkles, User, Award, ExternalLink 
} from 'lucide-react';
import { VocabSet, VocabItem, GameConfig, GameSession } from '../../types';
import { GAMES_LIST } from '../../lib/game-engine/gameList';
import { speakEnglish } from '../../lib/game-engine/speech';

// Import our games
import FlashcardGame from './FlashcardGame';
import QuizGame from './QuizGame';
import FillBlankGame from './FillBlankGame';
import MatchingGame from './MatchingGame';
import MemoryGame from './MemoryGame';

interface StudentLearningAreaProps {
  vocabSet: VocabSet;
  studentName: string;
  assignmentId?: string;
  initialGameId?: string;
  onBack: () => void;
}

export default function StudentLearningArea({ 
  vocabSet, 
  studentName: propStudentName, 
  assignmentId, 
  initialGameId, 
  onBack 
}: StudentLearningAreaProps) {
  const [studentName, setStudentName] = useState(propStudentName || '');
  const [nameSubmitted, setNameSubmitted] = useState(!!propStudentName);
  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);
  const [activeItems, setActiveItems] = useState<VocabItem[]>([...vocabSet.items]);
  const [isRandomized, setIsRandomized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [gameResult, setGameResult] = useState<{ score: number; correct: number; incorrect: number } | null>(null);

  // Load initial game if requested
  useEffect(() => {
    if (initialGameId) {
      const g = GAMES_LIST.find(game => game.gameId === initialGameId);
      if (g) setSelectedGame(g);
    } else {
      setSelectedGame(GAMES_LIST[0]); // Default to first game
    }
  }, [initialGameId]);

  // Set up student session on game select
  useEffect(() => {
    if (!selectedGame || !nameSubmitted || !studentName) return;

    setGameResult(null);

    // Create a new session on the server
    fetch('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId,
        vocabSetId: vocabSet.id,
        vocabSetTitle: vocabSet.title,
        gameId: selectedGame.gameId,
        studentName: studentName
      })
    })
    .then(res => res.json())
    .then(data => {
      setSession(data);
    })
    .catch(err => console.error("Error starting game session:", err));
  }, [selectedGame, nameSubmitted, studentName, vocabSet, assignmentId]);

  const handleShuffle = () => {
    if (isRandomized) {
      // Revert to original order
      setActiveItems([...vocabSet.items].sort((a, b) => a.displayOrder - b.displayOrder));
    } else {
      // Shuffle
      setActiveItems([...vocabSet.items].sort(() => Math.random() - 0.5));
    }
    setIsRandomized(!isRandomized);
  };

  const handleToggleFullscreen = () => {
    const element = document.getElementById('game-stage');
    if (!element) return;

    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => console.error("Error enabling fullscreen:", err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Synchronize fullscreen state (e.g. if exited via Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleGameComplete = (score: number, correct: number, incorrect: number) => {
    setGameResult({ score, correct, incorrect });

    if (!session) return;

    // Update session stats on the server
    fetch(`/api/game-sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score,
        totalQuestions: correct + incorrect,
        correctAnswers: correct,
        incorrectAnswers: incorrect
      })
    })
    .then(res => res.json())
    .then(data => {
      setSession(data);
    })
    .catch(err => console.error("Error updating game session:", err));
  };

  const playTermSound = (term: string) => {
    if (!isMuted) {
      speakEnglish(term);
    }
  };

  // Render game in focus
  const renderActiveGame = () => {
    if (!selectedGame) return null;

    const gameProps = {
      items: activeItems,
      config: selectedGame.config,
      onComplete: handleGameComplete,
      isMuted,
      setIsMuted,
      isRandomized,
      onToggleRandom: handleShuffle,
      isFullscreen,
      onToggleFullscreen: handleToggleFullscreen
    };

    switch (selectedGame.componentName) {
      case 'FlashcardGame':
        return <FlashcardGame {...gameProps} />;
      case 'QuizGame':
        return <QuizGame {...gameProps} />;
      case 'FillBlankGame':
        return <FillBlankGame {...gameProps} />;
      case 'MatchingGame':
        return <MatchingGame {...gameProps} />;
      case 'MemoryGame':
        return <MemoryGame {...gameProps} />;
      default:
        return (
          <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
            <p>Game mode này đang được phát triển.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16" id="student-area-root">
      {/* Upper Navigation Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 shadow-xs" id="student-header">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 font-semibold text-sm transition-all bg-gray-50 hover:bg-indigo-50 p-2.5 px-4 rounded-xl cursor-pointer border border-gray-100"
            id="back-to-menu-btn"
          >
            <ArrowLeft size={16} />
            <span>Thoát ra</span>
          </button>

          <div className="text-center hidden md:block">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">HỌC TỪ VỰNG TIẾNG ANH</span>
            <h1 className="text-lg font-black text-gray-800 leading-tight">{vocabSet.title}</h1>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">
              <User size={14} />
              <span>Học sinh: {studentName || 'Chưa đặt tên'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Game Stage and Word Lists */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Ask for Name if not submitted */}
          {!nameSubmitted ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6" id="name-prompt-container">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <BookOpen size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-gray-800">Bắt đầu học từ vựng!</h2>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Hãy nhập tên của em để lưu điểm, làm bài tập thầy cô giao và theo dõi kết quả nhé.
                </p>
              </div>

              <div className="max-w-sm mx-auto flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Nhập họ và tên của em..."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="flex-1 p-4 border-2 border-gray-200 rounded-2xl font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-center text-lg"
                  id="student-name-input"
                />
                <button
                  onClick={() => studentName.trim() && setNameSubmitted(true)}
                  disabled={!studentName.trim()}
                  className="py-4 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer text-lg whitespace-nowrap"
                  id="submit-name-btn"
                >
                  Bắt đầu chơi
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Main Active Gameplay Area Container */}
              <div 
                id="game-stage"
                className={`bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl transition-all duration-300 relative ${
                  isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto flex flex-col justify-center max-w-none rounded-none' : ''
                }`}
              >
                {/* Active Game Utilities Bar */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h2 className="font-black text-gray-800 text-base md:text-lg">
                        {selectedGame?.title}
                      </h2>
                      <p className="text-xs text-gray-400 font-medium hidden sm:block">
                        {selectedGame?.description}
                      </p>
                    </div>
                  </div>

                  {/* Top Game Options (Sound, Shuffle, Fullscreen) */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-2 rounded-xl transition-all border cursor-pointer ${
                        isMuted 
                          ? 'bg-rose-50 border-rose-200 text-rose-500' 
                          : 'bg-gray-50 border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-gray-100'
                      }`}
                      title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                      id="mute-toggle"
                    >
                      <Volume2 size={18} className={isMuted ? 'opacity-40' : ''} />
                    </button>

                    <button
                      onClick={handleShuffle}
                      className={`p-2 rounded-xl transition-all border cursor-pointer ${
                        isRandomized 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                          : 'bg-gray-50 border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-gray-100'
                      }`}
                      title="Trộn từ vựng"
                      id="shuffle-toggle"
                    >
                      <Shuffle size={18} />
                    </button>

                    <button
                      onClick={handleToggleFullscreen}
                      className="p-2 bg-gray-50 border border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                      title="Toàn màn hình"
                      id="fullscreen-toggle"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Render game area */}
                <div className="relative" id="active-game-viewport">
                  {renderActiveGame()}
                </div>

                {/* Score Summary Modal overlay after complete */}
                {gameResult && (
                  <div className="absolute inset-0 bg-white/95 rounded-3xl z-10 flex flex-col items-center justify-center p-6 text-center space-y-6" id="score-summary-overlay">
                    <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                      <Award size={54} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black text-gray-800">Hoàn thành bài học!</h3>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">
                        Điểm số của em đã được ghi nhận thành công trên hệ thống của giáo viên.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 bg-gray-50 border border-gray-100 rounded-2xl p-4 px-8 w-full max-w-sm">
                      <div className="text-center">
                        <span className="text-xs font-bold text-gray-400 block">ĐIỂM</span>
                        <span className="text-2xl font-black text-emerald-600">{gameResult.score}</span>
                      </div>
                      <div className="border-r border-gray-200" />
                      <div className="text-center">
                        <span className="text-xs font-bold text-gray-400 block">ĐÚNG</span>
                        <span className="text-2xl font-black text-indigo-600">{gameResult.correct}</span>
                      </div>
                      <div className="border-r border-gray-200" />
                      <div className="text-center">
                        <span className="text-xs font-bold text-gray-400 block">SAI</span>
                        <span className="text-2xl font-black text-rose-600">{gameResult.incorrect}</span>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => setGameResult(null)}
                        className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all cursor-pointer text-sm"
                        id="retry-overlay-btn"
                      >
                        Chơi lại
                      </button>
                      <button
                        onClick={() => {
                          const nextGameIdx = (GAMES_LIST.findIndex(g => g.gameId === selectedGame?.gameId) + 1) % GAMES_LIST.length;
                          setSelectedGame(GAMES_LIST[nextGameIdx]);
                        }}
                        className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer text-sm"
                        id="next-game-overlay-btn"
                      >
                        Chuyển Game tiếp theo
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </>
          )}
        </div>

        {/* Right Side: Game Modes Selector Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl" id="games-catalogue-sidebar">
            <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-100">
              <Award className="text-indigo-600 animate-pulse" size={20} />
              <h3 className="font-extrabold text-gray-800 text-base md:text-lg">Các trò chơi học từ</h3>
            </div>

            {/* List Game Templates grouped by category */}
            <div className="space-y-6" id="games-grouped-list">
              {['flashcard', 'quiz', 'fill', 'matching', 'memory'].map(category => {
                const categoryGames = GAMES_LIST.filter(g => g.category === category);
                const categoryTitles: Record<string, string> = {
                  flashcard: '⚡ Nhóm Flashcard',
                  quiz: '✏️ Nhóm Trắc nghiệm',
                  fill: '⌨️ Nhóm Điền từ / Viết',
                  matching: '🧩 Nhóm Ghép đôi',
                  memory: '🧠 Nhóm Luyện trí nhớ'
                };

                return (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                      {categoryTitles[category]}
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {categoryGames.map(game => {
                        const isActive = selectedGame?.gameId === game.gameId;

                        return (
                          <button
                            key={game.gameId}
                            onClick={() => {
                              if (nameSubmitted) {
                                setSelectedGame(game);
                              } else {
                                // Direct to focus name prompt
                                const element = document.getElementById('student-name-input');
                                element?.focus();
                              }
                            }}
                            className={`flex items-start text-left p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                              isActive 
                                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                                : 'border-gray-100 hover:border-indigo-100 hover:bg-gray-50/50'
                            }`}
                            id={`sidebar-game-btn-${game.gameId}`}
                          >
                            <span className={`p-2.5 bg-gradient-to-br ${game.color} text-white rounded-xl shadow-xs shrink-0 mr-3 mt-0.5`}>
                              <BookOpen size={16} />
                            </span>
                            <div className="space-y-0.5">
                              <span className="font-bold text-gray-800 text-sm leading-snug block">
                                {game.title}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold uppercase block">
                                {game.category} game
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
