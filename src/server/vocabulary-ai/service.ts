import { Type } from '@google/genai';

interface AiTextResult {
  text: string;
  provider: string;
  errors: string[];
}

interface VocabularyAiServiceOptions {
  provider: {
    generateText(prompt: string, config?: any): Promise<AiTextResult>;
    sanitizeError(provider: string, error: any): string;
  };
  warn?: (...values: any[]) => void;
}

const ALLOWED_PARTS_OF_SPEECH = [
  'Noun', 'Pronoun', 'Verb', 'Adjective', 'Adverb', 'Preposition',
  'Conjunction', 'Interjection', 'Article', 'Determiner',
];

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function parseAiJson(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('AI returned empty text.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match?.[1]) return JSON.parse(match[1].trim());
    throw new Error('AI returned invalid JSON.');
  }
}

function normalizePartOfSpeech(value: any) {
  const text = String(value || '').trim().toLowerCase();
  const match = ALLOWED_PARTS_OF_SPEECH.find(pos => pos.toLowerCase() === text);
  if (match) return match;
  if (text.includes('pronoun')) return 'Pronoun';
  if (text.includes('adjective')) return 'Adjective';
  if (text.includes('adverb')) return 'Adverb';
  if (text.includes('preposition')) return 'Preposition';
  if (text.includes('conjunction')) return 'Conjunction';
  if (text.includes('interjection')) return 'Interjection';
  if (text.includes('article')) return 'Article';
  if (text.includes('determiner')) return 'Determiner';
  if (text.includes('verb')) return 'Verb';
  return 'Noun';
}

function normalizeForExampleCheck(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWeakVocabularyExample(example: any, word: string) {
  const normalizedExample = normalizeForExampleCheck(example);
  const normalizedWord = normalizeForExampleCheck(word);
  if (!normalizedExample || !normalizedWord || !normalizedExample.includes(normalizedWord)) return true;
  return normalizedExample.startsWith('the word ')
    || normalizedExample.startsWith('this word ')
    || normalizedExample.includes('appears often in everyday english')
    || normalizedExample.includes('students should practice')
    || normalizedExample.includes('is a vocabulary word');
}

function hashText(value: string) {
  return Array.from(value || '').reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 0);
}

function buildFallbackExample(word: string, meaning?: string) {
  const wordForSentence = String(word || '').trim() || 'learning';
  const meaningForSentence = String(meaning || '').trim() || wordForSentence;
  const templates = [
    {
      example: `During a lively class discussion, ${wordForSentence} helped everyone connect the lesson with something useful in daily life.`,
      exampleMeaning: `Trong một buổi thảo luận sôi nổi trên lớp, ${meaningForSentence} đã giúp mọi người liên hệ bài học với điều hữu ích trong đời sống hằng ngày.`,
    },
    {
      example: `After school, I wrote ${wordForSentence} in my notebook and used it in a sentence about my own day.`,
      exampleMeaning: `Sau giờ học, tôi viết ${meaningForSentence} vào vở và dùng nó trong một câu nói về ngày của chính mình.`,
    },
    {
      example: `When the group project became difficult, ${wordForSentence} gave us a clear idea to explain our work with more confidence.`,
      exampleMeaning: `Khi bài làm nhóm trở nên khó hơn, ${meaningForSentence} đã cho chúng tôi một ý tưởng rõ ràng để giải thích bài làm tự tin hơn.`,
    },
    {
      example: `At home, my younger brother asked about ${wordForSentence}, so I tried to explain it with a simple and funny example.`,
      exampleMeaning: `Ở nhà, em trai tôi hỏi về ${meaningForSentence}, nên tôi cố giải thích bằng một ví dụ đơn giản và thú vị.`,
    },
    {
      example: `In the middle of the lesson, the teacher used ${wordForSentence} to turn a normal question into an interesting challenge.`,
      exampleMeaning: `Giữa giờ học, giáo viên đã dùng ${meaningForSentence} để biến một câu hỏi bình thường thành một thử thách thú vị.`,
    },
    {
      example: `Before the quiz, I reviewed ${wordForSentence} carefully because small details can make a big difference in learning.`,
      exampleMeaning: `Trước bài kiểm tra, tôi ôn lại ${meaningForSentence} thật cẩn thận vì những chi tiết nhỏ có thể tạo nên khác biệt lớn trong học tập.`,
    },
    {
      example: `My friend smiled when she finally understood ${wordForSentence}, and the whole exercise suddenly felt much easier.`,
      exampleMeaning: `Bạn tôi mỉm cười khi cuối cùng đã hiểu ${meaningForSentence}, và cả bài luyện tập bỗng trở nên dễ hơn nhiều.`,
    },
    {
      example: `On the classroom board, ${wordForSentence} became the key idea that helped us remember the story behind the lesson.`,
      exampleMeaning: `Trên bảng lớp, ${meaningForSentence} trở thành ý chính giúp chúng tôi nhớ câu chuyện phía sau bài học.`,
    },
  ];
  return templates[Math.abs(hashText(`${wordForSentence}|${meaningForSentence}`)) % templates.length];
}

function getFallbackVocabulary(topic: string, count: number): any[] {
  const normalized = topic.toLowerCase().trim();
  if (normalized.includes('animal') || normalized.includes('động vật') || normalized.includes('con vật')) {
    return [
      { term: 'Elephant', meaning: 'Con voi', ipa: '/ˈelɪfənt/', pos: 'Noun', example: 'The elephant is very large.', exampleMeaning: 'Con voi rất to lớn.' },
      { term: 'Tiger', meaning: 'Con hổ', ipa: '/ˈtaɪɡə(r)/', pos: 'Noun', example: 'The tiger runs very fast.', exampleMeaning: 'Con hổ chạy rất nhanh.' },
      { term: 'Monkey', meaning: 'Con khỉ', ipa: '/ˈmʌŋki/', pos: 'Noun', example: 'The monkey loves eating bananas.', exampleMeaning: 'Con khỉ thích ăn chuối.' },
      { term: 'Dolphin', meaning: 'Cá heo', ipa: '/ˈdɒlfɪn/', pos: 'Noun', example: 'Dolphins are very friendly.', exampleMeaning: 'Cá heo rất thân thiện.' },
      { term: 'Giraffe', meaning: 'Hươu cao cổ', ipa: '/dʒɪˈrɑːf/', pos: 'Noun', example: 'The giraffe has a very long neck.', exampleMeaning: 'Hươu cao cổ có chiếc cổ rất dài.' },
    ].slice(0, count);
  }
  if (normalized.includes('school') || normalized.includes('trường học') || normalized.includes('lớp')) {
    return [
      { term: 'Teacher', meaning: 'Giáo viên', ipa: '/ˈtiːtʃə(r)/', pos: 'Noun', example: 'Our teacher is very kind.', exampleMeaning: 'Giáo viên của chúng tôi rất tốt bụng.' },
      { term: 'Student', meaning: 'Học sinh', ipa: '/ˈstjuːdnt/', pos: 'Noun', example: 'The students are listening.', exampleMeaning: 'Các học sinh đang lắng nghe.' },
      { term: 'Classroom', meaning: 'Phòng học', ipa: '/ˈklɑːsruːm/', pos: 'Noun', example: 'Our classroom has a big board.', exampleMeaning: 'Phòng học của chúng tôi có bảng lớn.' },
    ].slice(0, count);
  }
  return [{
    term: topic.charAt(0).toUpperCase() + topic.slice(1),
    meaning: `Từ về ${topic}`,
    ipa: '/ˈtɒpɪk/',
    pos: 'Noun',
    example: 'This is an example.',
    exampleMeaning: 'Đây là ví dụ.',
  }];
}

export function createVocabularyAiService(options: VocabularyAiServiceOptions) {
  const warn = options.warn || console.warn;

  const generateIpa = async (wordValue: any) => {
    if (!wordValue || typeof wordValue !== 'string') {
      throw httpError(400, "Tham số 'word' là bắt buộc.");
    }
    const word = wordValue;
    try {
      const result = await options.provider.generateText(
        `Provide the standard American English IPA phonetic transcription for the word/phrase: "${word}". Output ONLY the IPA string surrounded by slashes. Do not add any extra explanations or formatting.`,
      );
      return {
        ipa: result.text || `/${word.toLowerCase()}/`,
        aiProvider: result.provider,
        isFallback: result.provider === 'fallback',
        aiErrors: result.errors,
      };
    } catch (error: any) {
      warn('AI IPA generator service unavailable, returning fallback:', error.message);
      return {
        ipa: `/${word.toLowerCase()}/`,
        isFallback: true,
        aiProvider: 'fallback',
        aiErrors: [options.provider.sanitizeError('AI', error)],
      };
    }
  };

  const generateVocabDetail = async (wordValue: any, meaningValue: any, gradeValue: any) => {
    if (!wordValue || typeof wordValue !== 'string') {
      throw httpError(400, "Tham số 'word' là bắt buộc.");
    }
    const word = wordValue;
    const meaning = meaningValue;
    const fallbackExample = buildFallbackExample(word, meaning);
    const fallback = {
      term: word,
      meaning: meaning || '',
      ipa: `/${word.toLowerCase()}/`,
      pos: 'Noun',
      example: fallbackExample.example,
      exampleMeaning: fallbackExample.exampleMeaning,
      audioUrl: '',
    };
    const prompt = `Complete missing English vocabulary learning details for this row.
Word or phrase: "${word}"
Existing Vietnamese meaning, if any: "${meaning || ''}"
Target level: "${gradeValue || 'primary school'}"

Return ONLY one valid JSON object with meaning, ipa, pos, example, exampleMeaning and audioUrl. The example must contain the exact vocabulary word or phrase, use it naturally in a specific daily-life context, and not define or discuss the word itself. Choose pos from: ${ALLOWED_PARTS_OF_SPEECH.join(', ')}.`;
    try {
      const result = await options.provider.generateText(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meaning: { type: Type.STRING }, ipa: { type: Type.STRING }, pos: { type: Type.STRING },
            example: { type: Type.STRING }, exampleMeaning: { type: Type.STRING }, audioUrl: { type: Type.STRING },
          },
          required: ['meaning', 'ipa', 'pos', 'example', 'exampleMeaning'],
        },
      });
      if (result.provider === 'fallback') {
        return { ...fallback, isFallback: true, aiProvider: 'fallback', aiErrors: result.errors };
      }
      const parsedData = parseAiJson(result.text);
      const exampleData = isWeakVocabularyExample(parsedData.example, word)
        ? buildFallbackExample(word, parsedData.meaning || meaning)
        : { example: parsedData.example, exampleMeaning: parsedData.exampleMeaning };
      return {
        ...fallback,
        ...parsedData,
        pos: normalizePartOfSpeech(parsedData.pos),
        example: exampleData.example,
        exampleMeaning: exampleData.exampleMeaning || parsedData.exampleMeaning || fallback.exampleMeaning,
        term: word,
        aiProvider: result.provider,
        aiErrors: result.errors,
      };
    } catch (error: any) {
      warn('AI vocab detail service unavailable, returning fallback:', error.message);
      return {
        ...fallback,
        isFallback: true,
        aiProvider: 'fallback',
        aiErrors: [options.provider.sanitizeError('AI', error)],
      };
    }
  };

  const generateVocabulary = async (topicValue: any, gradeValue: any, countValue = 5) => {
    if (!topicValue || typeof topicValue !== 'string') {
      throw httpError(400, "Tham số 'topic' là bắt buộc.");
    }
    const topic = topicValue;
    const wordsCount = countValue;
    const prompt = `Generate a JSON array of exactly ${wordsCount} English vocabulary words for topic: "${topic}" targeted for students at grade level: "${gradeValue || 'primary school'}". Each item must contain term, Vietnamese meaning, IPA, one allowed part of speech, one varied daily-life example containing the exact term, and its Vietnamese translation. Return ONLY valid JSON.`;
    try {
      const result = await options.provider.generateText(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING }, meaning: { type: Type.STRING }, ipa: { type: Type.STRING },
              pos: { type: Type.STRING }, example: { type: Type.STRING }, exampleMeaning: { type: Type.STRING },
            },
            required: ['term', 'meaning', 'ipa', 'pos', 'example', 'exampleMeaning'],
          },
        },
      });
      if (result.provider === 'fallback') {
        return getFallbackVocabulary(topic, wordsCount).map(item => ({
          ...item, isFallback: true, aiProvider: 'fallback', aiErrors: result.errors,
        }));
      }
      const parsedData = parseAiJson(result.text);
      return Array.isArray(parsedData) ? parsedData.map((item: any) => {
        const fallbackExample = buildFallbackExample(item.term, item.meaning);
        const exampleData = isWeakVocabularyExample(item.example, item.term)
          ? fallbackExample
          : { example: item.example, exampleMeaning: item.exampleMeaning };
        return {
          ...item,
          pos: normalizePartOfSpeech(item.pos),
          example: exampleData.example,
          exampleMeaning: exampleData.exampleMeaning || item.exampleMeaning || fallbackExample.exampleMeaning,
          aiProvider: result.provider,
          aiErrors: result.errors,
        };
      }) : [];
    } catch (error: any) {
      warn('AI generation service unavailable, returning fallback:', error.message);
      return getFallbackVocabulary(topic, wordsCount).map(item => ({
        ...item,
        isFallback: true,
        aiProvider: 'fallback',
        aiErrors: [options.provider.sanitizeError('AI', error)],
      }));
    }
  };

  return { generateIpa, generateVocabDetail, generateVocabulary };
}
