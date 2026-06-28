import { GameConfig } from '../../types';

export const GAMES_LIST: GameConfig[] = [
  // --- FLASHCARD GROUP ---
  {
    gameId: 'flashcard-en-vi',
    title: 'Flashcard Anh → Việt',
    description: 'Xem từ tiếng Anh và bấm lật để xem nghĩa tiếng Việt.',
    category: 'flashcard',
    icon: 'Layers',
    color: 'from-blue-500 to-indigo-600',
    componentName: 'FlashcardGame',
    requiredFields: ['term', 'meaning'],
    config: {
      front: 'term',
      back: 'meaning',
      enableSound: true,
      autoPlaySound: false
    }
  },
  {
    gameId: 'flashcard-vi-en',
    title: 'Flashcard Việt → Anh',
    description: 'Xem nghĩa tiếng Việt và bấm lật để đoán từ tiếng Anh.',
    category: 'flashcard',
    icon: 'Layers',
    color: 'from-indigo-500 to-purple-600',
    componentName: 'FlashcardGame',
    requiredFields: ['term', 'meaning'],
    config: {
      front: 'meaning',
      back: 'term',
      enableSound: true,
      autoPlaySound: false
    }
  },
  {
    gameId: 'flashcard-sound',
    title: 'Flashcard Âm thanh',
    description: 'Nghe phát âm tiếng Anh rồi lật thẻ để xem từ và nghĩa.',
    category: 'flashcard',
    icon: 'Volume2',
    color: 'from-purple-500 to-pink-600',
    componentName: 'FlashcardGame',
    requiredFields: ['term', 'meaning'],
    config: {
      front: 'sound_only', // Custom mode where the front only shows audio button
      back: 'both',
      enableSound: true,
      autoPlaySound: true
    }
  },

  // --- QUIZ GROUP ---
  {
    gameId: 'quiz-en-vi',
    title: 'Chọn nghĩa đúng',
    description: 'Nhìn từ tiếng Anh và chọn nghĩa tiếng Việt chính xác trong 4 đáp án.',
    category: 'quiz',
    icon: 'HelpCircle',
    color: 'from-emerald-500 to-teal-600',
    componentName: 'QuizGame',
    requiredFields: ['term', 'meaning'],
    config: {
      questionType: 'term', // Show English term
      answerType: 'meaning', // Answer in Vietnamese meaning
      enableSound: true
    }
  },
  {
    gameId: 'quiz-vi-en',
    title: 'Chọn từ đúng',
    description: 'Nhìn nghĩa tiếng Việt và chọn từ tiếng Anh chính xác trong 4 đáp án.',
    category: 'quiz',
    icon: 'CheckSquare',
    color: 'from-teal-500 to-green-600',
    componentName: 'QuizGame',
    requiredFields: ['term', 'meaning'],
    config: {
      questionType: 'meaning', // Show Vietnamese meaning
      answerType: 'term', // Answer in English term
      enableSound: false
    }
  },
  {
    gameId: 'quiz-sound',
    title: 'Nghe và chọn từ',
    description: 'Nghe phát âm tiếng Anh và chọn từ viết đúng.',
    category: 'quiz',
    icon: 'Radio',
    color: 'from-cyan-500 to-blue-600',
    componentName: 'QuizGame',
    requiredFields: ['term'],
    config: {
      questionType: 'sound', // Listen to term sound
      answerType: 'term', // Answer in English term
      enableSound: true,
      autoPlaySound: true
    }
  },

  // --- FILL BLANK GROUP ---
  {
    gameId: 'fill-meaning',
    title: 'Điền từ theo nghĩa',
    description: 'Nhìn nghĩa tiếng Việt và gõ từ tiếng Anh hoàn chỉnh.',
    category: 'fill',
    icon: 'Edit3',
    color: 'from-amber-500 to-orange-600',
    componentName: 'FillBlankGame',
    requiredFields: ['term', 'meaning'],
    config: {
      mode: 'complete', // Write entire word
      promptType: 'meaning'
    }
  },
  {
    gameId: 'fill-missing',
    title: 'Điền chữ cái còn thiếu',
    description: 'Gõ các ký tự còn thiếu của từ tiếng Anh để hoàn thành từ.',
    category: 'fill',
    icon: 'Type',
    color: 'from-orange-500 to-rose-600',
    componentName: 'FillBlankGame',
    requiredFields: ['term'],
    config: {
      mode: 'missing_letters', // Fill hidden letter blanks, e.g. a_p_e
      promptType: 'meaning_and_hint'
    }
  },

  // --- MATCHING GROUP ---
  {
    gameId: 'matching-word-meaning',
    title: 'Ghép cặp từ - nghĩa',
    description: 'Ghép nối thẻ tiếng Anh với nghĩa tiếng Việt tương ứng càng nhanh càng tốt.',
    category: 'matching',
    icon: 'Grid',
    color: 'from-rose-500 to-red-600',
    componentName: 'MatchingGame',
    requiredFields: ['term', 'meaning'],
    config: {
      matchType: 'term_to_meaning'
    }
  },

  // --- MEMORY GROUP ---
  {
    gameId: 'memory-match',
    title: 'Lật thẻ trí nhớ',
    description: 'Tìm các cặp thẻ tiếng Anh và nghĩa tiếng Việt tương ứng bằng cách lật mở các thẻ bị ẩn.',
    category: 'memory',
    icon: 'Brain',
    color: 'from-fuchsia-500 to-pink-600',
    componentName: 'MemoryGame',
    requiredFields: ['term', 'meaning'],
    config: {
      gridSize: 'small'
    }
  }
];
