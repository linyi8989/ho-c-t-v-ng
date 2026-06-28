import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side JSON storage path
const DB_PATH = path.join(process.cwd(), "db.json");

// Define basic interface for DB
interface DatabaseSchema {
  vocabSets: any[];
  classes: any[];
  classMembers: any[];
  assignments: any[];
  gameSessions: any[];
  users: any[];
}

// Default DB state with specified mock data
const defaultDbState: DatabaseSchema = {
  users: [
    { id: "teacher-1", name: "Cô Thảo English", email: "thao.teacher@gmail.com", role: "teacher" },
    { id: "admin-1", name: "Hệ thống Admin", email: "admin@vocabulary.edu.vn", role: "admin" }
  ],
  classes: [
    { id: "class-1", name: "Lớp 3A1 - Tiếng Anh Tiểu Học", code: "LOP3A1", teacherId: "teacher-1" },
    { id: "class-2", name: "Lớp 6B2 - Tiếng Anh THCS", code: "LOP6B2", teacherId: "teacher-1" }
  ],
  classMembers: [
    { id: "member-1", classId: "class-1", studentName: "Nguyễn Văn An" },
    { id: "member-2", classId: "class-1", studentName: "Trần Thị Bình" },
    { id: "member-3", classId: "class-1", studentName: "Lê Hoàng Nam" },
    { id: "member-4", classId: "class-2", studentName: "Phạm Hải Đăng" },
    { id: "member-5", classId: "class-2", studentName: "Nguyễn Khánh Linh" }
  ],
  vocabSets: [
    {
      id: "set-1",
      title: "Ordinal Numbers (Số thứ tự)",
      description: "Học cách viết và phát âm các số thứ tự cơ bản từ thứ nhất đến thứ mười trong tiếng Anh.",
      subject: "Numbers",
      tags: ["numbers", "basic", "math"],
      gradeLevel: "Lớp 3",
      createdAt: new Date().toISOString(),
      createdBy: "admin-1",
      creatorName: "Hệ thống Admin",
      status: "public",
      items: [
        { id: "item-1-1", term: "First", meaning: "Thứ nhất", ipa: "/fɜːst/", pos: "Adjective", example: "He won the first prize in the competition.", exampleMeaning: "Cậu ấy đã giành giải nhất trong cuộc thi.", displayOrder: 1 },
        { id: "item-1-2", term: "Second", meaning: "Thứ hai", ipa: "/ˈsekənd/", pos: "Adjective", example: "This is the second time I have visited Hanoi.", exampleMeaning: "Đây là lần thứ hai tôi đến thăm Hà Nội.", displayOrder: 2 },
        { id: "item-1-3", term: "Third", meaning: "Thứ ba", ipa: "/θɜːd/", pos: "Adjective", example: "My office is on the third floor.", exampleMeaning: "Văn phòng của tôi nằm ở tầng ba.", displayOrder: 3 },
        { id: "item-1-4", term: "Fourth", meaning: "Thứ tư", ipa: "/fɔːθ/", pos: "Adjective", example: "April is the fourth month of the year.", exampleMeaning: "Tháng Tư là tháng thứ tư trong năm.", displayOrder: 4 },
        { id: "item-1-5", term: "Fifth", meaning: "Thứ năm", ipa: "/fɪfθ/", pos: "Adjective", example: "She finished in fifth place in the race.", exampleMeaning: "Cô ấy về đích ở vị trí thứ năm trong cuộc đua.", displayOrder: 5 },
        { id: "item-1-6", term: "Sixth", meaning: "Thứ sáu", ipa: "/sɪksθ/", pos: "Adjective", example: "He is celebrating his sixth birthday today.", exampleMeaning: "Hôm nay cậu ấy đang mừng sinh nhật lần thứ sáu.", displayOrder: 6 },
        { id: "item-1-7", term: "Seventh", meaning: "Thứ bảy", ipa: "/ˈsevnθ/", pos: "Adjective", example: "We live on the seventh street.", exampleMeaning: "Chúng tôi sống ở con đường thứ bảy.", displayOrder: 7 },
        { id: "item-1-8", term: "Eighth", meaning: "Thứ tám", ipa: "/eɪtθ/", pos: "Adjective", example: "This is the eighth cup of water today.", exampleMeaning: "Đây là cốc nước thứ tám trong ngày hôm nay.", displayOrder: 8 },
        { id: "item-1-9", term: "Ninth", meaning: "Thứ chín", ipa: "/naɪnθ/", pos: "Adjective", example: "The ninth chapter of the book is very interesting.", exampleMeaning: "Chương thứ chín của cuốn sách rất thú vị.", displayOrder: 9 },
        { id: "item-1-10", term: "Tenth", meaning: "Thứ mười", ipa: "/tenθ/", pos: "Adjective", example: "Today is our tenth wedding anniversary.", exampleMeaning: "Hôm nay là kỷ niệm mười năm ngày cưới của chúng tôi.", displayOrder: 10 }
      ]
    },
    {
      id: "set-2",
      title: "Animals - Basic (Động vật cơ bản)",
      description: "Bộ từ vựng về các loài động vật quen thuộc xung quanh chúng ta dành cho học sinh tiểu học.",
      subject: "Science",
      tags: ["animals", "nature", "basic"],
      gradeLevel: "Lớp 3",
      createdAt: new Date().toISOString(),
      createdBy: "admin-1",
      creatorName: "Hệ thống Admin",
      status: "public",
      items: [
        { id: "item-2-1", term: "cat", meaning: "con mèo", ipa: "/kæt/", pos: "Noun", example: "The cat is sleeping on the warm sofa.", exampleMeaning: "Con mèo đang ngủ trên chiếc ghế sofa ấm áp.", displayOrder: 1 },
        { id: "item-2-2", term: "dog", meaning: "con chó", ipa: "/dɒɡ/", pos: "Noun", example: "My dog loves to run in the park.", exampleMeaning: "Con chó của tôi thích chạy nhảy trong công viên.", displayOrder: 2 },
        { id: "item-2-3", term: "bird", meaning: "con chim", ipa: "/bɜːd/", pos: "Noun", example: "A colorful bird is singing on the tree branch.", exampleMeaning: "Một chú chim đầy màu sắc đang hót trên cành cây.", displayOrder: 3 },
        { id: "item-2-4", term: "fish", meaning: "con cá", ipa: "/fɪʃ/", pos: "Noun", example: "We have three gold fish in the tank.", exampleMeaning: "Chúng tôi có ba chú cá vàng trong bể.", displayOrder: 4 },
        { id: "item-2-5", term: "elephant", meaning: "con voi", ipa: "/ˈelɪfənt/", pos: "Noun", example: "The elephant is the largest land mammal.", exampleMeaning: "Con voi là loài động vật có vú lớn nhất trên mặt đất.", displayOrder: 5 },
        { id: "item-2-6", term: "tiger", meaning: "con hổ", ipa: "/ˈtaɪɡə(r)/", pos: "Noun", example: "The tiger has orange and black stripes.", exampleMeaning: "Con hổ có các vằn màu cam và đen.", displayOrder: 6 },
        { id: "item-2-7", term: "lion", meaning: "con sư tử", ipa: "/ˈlaɪən/", pos: "Noun", example: "The lion is known as the king of the jungle.", exampleMeaning: "Sư tử được biết đến là chúa tể rừng xanh.", displayOrder: 7 },
        { id: "item-2-8", term: "monkey", meaning: "con khỉ", ipa: "/ˈmʌŋki/", pos: "Noun", example: "The monkey is swinging from branch to branch.", exampleMeaning: "Con khỉ đang chuyền từ cành này sang cành khác.", displayOrder: 8 }
      ]
    }
  ],
  assignments: [
    {
      id: "assign-1",
      classId: "class-1",
      className: "Lớp 3A1 - Tiếng Anh Tiểu Học",
      vocabSetId: "set-1",
      vocabSetTitle: "Ordinal Numbers (Số thứ tự)",
      gameId: "flashcard-en-vi",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: "teacher-1",
      title: "Học số thứ tự qua Flashcard"
    },
    {
      id: "assign-2",
      classId: "class-1",
      className: "Lớp 3A1 - Tiếng Anh Tiểu Học",
      vocabSetId: "set-2",
      vocabSetTitle: "Animals - Basic (Động vật cơ bản)",
      gameId: "quiz-en-vi",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: "teacher-1",
      title: "Trắc nghiệm động vật cơ bản"
    }
  ],
  gameSessions: []
};

// Helper to read database
function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDbState, null, 2), "utf-8");
      return defaultDbState;
    }
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file. Using default state.", err);
    return defaultDbState;
  }
}

// Helper to write database
function writeDb(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Middleware
app.use(express.json());

// Initialize Gemini client (Lazy initialization safe)
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined in environment variables. AI operations will fail.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// ============================================================================
// API ROUTES
// ============================================================================

// Robust helper to generate fallback vocabulary matching any topic
function getFallbackVocabulary(topic: string, count: number): any[] {
  const normalized = topic.toLowerCase().trim();
  
  // Topic 1: Animals / Động vật
  if (normalized.includes("animal") || normalized.includes("động vật") || normalized.includes("con vật")) {
    const pool = [
      { term: "Elephant", meaning: "Con voi", ipa: "/ˈelɪfənt/", pos: "Noun", example: "The elephant is very large.", exampleMeaning: "Con voi rất to lớn." },
      { term: "Tiger", meaning: "Con hổ", ipa: "/ˈtaɪɡə(r)/", pos: "Noun", example: "The tiger runs very fast.", exampleMeaning: "Con hổ chạy rất nhanh." },
      { term: "Monkey", meaning: "Con khỉ", ipa: "/ˈmʌŋki/", pos: "Noun", example: "The monkey loves eating bananas.", exampleMeaning: "Con khỉ thích ăn chuối." },
      { term: "Dolphin", meaning: "Cá heo", ipa: "/ˈdɒlfɪn/", pos: "Noun", example: "Dolphins are very friendly.", exampleMeaning: "Cá heo rất thân thiện." },
      { term: "Giraffe", meaning: "Hươu cao cổ", ipa: "/dʒɪˈrɑːf/", pos: "Noun", example: "The giraffe has a very long neck.", exampleMeaning: "Hươu cao cổ có chiếc cổ rất dài." },
      { term: "Kangaroo", meaning: "Chuột túi", ipa: "/ˌkæŋɡəˈruː/", pos: "Noun", example: "Kangaroos live in Australia.", exampleMeaning: "Chuột túi sống ở nước Úc." }
    ];
    return pool.slice(0, count);
  }

  // Topic 2: School / Trường học
  if (normalized.includes("school") || normalized.includes("trường học") || normalized.includes("lớp học") || normalized.includes("class")) {
    const pool = [
      { term: "Teacher", meaning: "Giáo viên", ipa: "/ˈtiːtʃə(r)/", pos: "Noun", example: "Our teacher is very kind.", exampleMeaning: "Giáo viên của chúng tôi rất tốt bụng." },
      { term: "Student", meaning: "Học sinh", ipa: "/ˈstjuːdnt/", pos: "Noun", example: "The students are listening to music.", exampleMeaning: "Các học sinh đang nghe nhạc." },
      { term: "Classroom", meaning: "Phòng học", ipa: "/ˈklɑːsruːm/", pos: "Noun", example: "Our classroom has a big board.", exampleMeaning: "Phòng học của chúng tôi có một chiếc bảng lớn." },
      { term: "Notebook", meaning: "Vở viết", ipa: "/ˈnəʊtbʊk/", pos: "Noun", example: "I write lessons in my notebook.", exampleMeaning: "Tôi viết bài học vào vở viết của mình." },
      { term: "Computer", meaning: "Máy tính", ipa: "/kəmˈpjuːtə(r)/", pos: "Noun", example: "We learn computer science on Fridays.", exampleMeaning: "Chúng tôi học tin học vào các ngày thứ Sáu." },
      { term: "Library", meaning: "Thư viện", ipa: "/ˈlaɪbrəri/", pos: "Noun", example: "I love reading books in the library.", exampleMeaning: "Tôi thích đọc sách trong thư viện." }
    ];
    return pool.slice(0, count);
  }

  // Topic 3: Family / Gia đình
  if (normalized.includes("family") || normalized.includes("gia đình")) {
    const pool = [
      { term: "Father", meaning: "Bố/Cha", ipa: "/ˈfɑːðə(r)/", pos: "Noun", example: "My father is a kind man.", exampleMeaning: "Bố tôi là một người đàn ông hiền từ." },
      { term: "Mother", meaning: "Mẹ", ipa: "/ˈmʌðə(r)/", pos: "Noun", example: "My mother cooks delicious food.", exampleMeaning: "Mẹ tôi nấu ăn rất ngon." },
      { term: "Brother", meaning: "Anh/Em trai", ipa: "/ˈbrʌðə(r)/", pos: "Noun", example: "My little brother loves playing toys.", exampleMeaning: "Em trai nhỏ của tôi thích chơi đồ chơi." },
      { term: "Sister", meaning: "Chị/Em gái", ipa: "/ˈsɪstə(r)/", pos: "Noun", example: "My sister is fifteen years old.", exampleMeaning: "Chị gái tôi mười lăm tuổi." },
      { term: "Grandfather", meaning: "Ông", ipa: "/ˈɡrændfɑːðə(r)/", pos: "Noun", example: "My grandfather tells beautiful stories.", exampleMeaning: "Ông tôi kể những câu chuyện rất hay." },
      { term: "Grandmother", meaning: "Bà", ipa: "/ˈɡrænmʌðə(r)/", pos: "Noun", example: "My grandmother is eighty years old.", exampleMeaning: "Bà tôi đã tám mươi tuổi rồi." }
    ];
    return pool.slice(0, count);
  }

  // Topic 4: Colors / Màu sắc
  if (normalized.includes("color") || normalized.includes("màu sắc") || normalized.includes("màu")) {
    const pool = [
      { term: "Rainbow", meaning: "Cầu vồng", ipa: "/ˈreɪnbəʊ/", pos: "Noun", example: "I can see seven colors in the rainbow.", exampleMeaning: "Tôi có thể thấy bảy màu sắc trên cầu vồng." },
      { term: "Purple", meaning: "Màu tím", ipa: "/ˈpɜːpl/", pos: "Adjective", example: "She wore a beautiful purple dress.", exampleMeaning: "Cô ấy đã mặc một chiếc váy màu tím tuyệt đẹp." },
      { term: "Orange", meaning: "Màu cam", ipa: "/ˈɒrɪndʒ/", pos: "Adjective", example: "Orange is a warm color.", exampleMeaning: "Màu cam là một tông màu ấm áp." },
      { term: "Yellow", meaning: "Màu vàng", ipa: "/ˈjeləʊ/", pos: "Adjective", example: "The sunflowers are bright yellow.", exampleMeaning: "Những bông hoa hướng dương có màu vàng rực rỡ." },
      { term: "Green", meaning: "Màu xanh lá", ipa: "/ɡriːn/", pos: "Adjective", example: "Grass is healthy and green.", exampleMeaning: "Thảm cỏ thì tươi xanh và khỏe khoắn." },
      { term: "Crimson", meaning: "Đỏ tươi / Đỏ thẫm", ipa: "/ˈkrɪmzn/", pos: "Adjective", example: "The autumn leaves turned crimson.", exampleMeaning: "Những chiếc lá mùa thu đã chuyển sang màu đỏ thẫm." }
    ];
    return pool.slice(0, count);
  }

  // Generic generator for any other topic
  const genericTerms = [
    { term: "Concept", meaning: "Khái niệm", ipa: "/ˈkɒnsept/", pos: "Noun", example: "We learned a new concept today.", exampleMeaning: "Hôm nay chúng tôi đã học một khái niệm mới." },
    { term: "Explore", meaning: "Khám phá", ipa: "/ɪkˈsplɔː(r)/", pos: "Verb", example: "Children love to explore nature.", exampleMeaning: "Trẻ em thích khám phá thiên nhiên." },
    { term: "Practice", meaning: "Luyện tập", ipa: "/ˈpræktɪs/", pos: "Verb", example: "You should practice English daily.", exampleMeaning: "Bạn nên luyện tập tiếng Anh mỗi ngày." },
    { term: "Excellent", meaning: "Xuất sắc", ipa: "/ˈeksələnt/", pos: "Adjective", example: "Your exam result is excellent!", exampleMeaning: "Kết quả thi của bạn thật xuất sắc!" },
    { term: "Create", meaning: "Sáng tạo", ipa: "/kriˈeɪt/", pos: "Verb", example: "Artists create beautiful paintings.", exampleMeaning: "Các nghệ sĩ sáng tạo nên những bức tranh đẹp." },
    { term: "Journey", meaning: "Hành trình", ipa: "/ˈdʒɜːni/", pos: "Noun", example: "Learning is a wonderful journey.", exampleMeaning: "Học tập là một hành trình tuyệt vời." },
    { term: "Achieve", meaning: "Đạt được", ipa: "/əˈtʃiːv/", pos: "Verb", example: "Work hard to achieve your dreams.", exampleMeaning: "Hãy chăm chỉ để đạt được ước mơ của bạn." }
  ];

  // Map generic words to have term reflecting the topic slightly
  const output = genericTerms.slice(0, count).map((item, idx) => {
    if (idx === 0) {
      return {
        term: topic.charAt(0).toUpperCase() + topic.slice(1).substring(0, 15),
        meaning: `Chủ đề ${topic}`,
        ipa: `/${topic.toLowerCase().replace(/[^a-z]/g, '') || 'topic'}/`,
        pos: "Noun",
        example: `Today's lesson is about ${topic}.`,
        exampleMeaning: `Bài học hôm nay nói về chủ đề ${topic}.`
      };
    }
    return item;
  });

  return output;
}

// AI Endpoint: Generate IPA transcription
app.post("/api/ai/ipa", async (req, res) => {
  const { word } = req.body;
  try {
    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Tham số 'word' là bắt buộc." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback if no API key is provided
      return res.json({ ipa: `/${word.toLowerCase()}/` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Provide the standard American English IPA phonetic transcription for the word/phrase: "${word}". Output ONLY the IPA string surrounded by slashes, e.g., "/ˈæpl/". Do not add any extra explanations or formatting.`,
    });

    const ipa = response.text?.trim() || `/${word.toLowerCase()}/`;
    res.json({ ipa });
  } catch (error: any) {
    console.warn("AI IPA generator service unavailable, returning smart fallback pronunciation:", error.message);
    const fallbackIpa = `/${(word || "").toLowerCase()}/`;
    res.json({ ipa: fallbackIpa, isFallback: true, warning: error.message });
  }
});

// AI Endpoint: Batch generate full vocab list
app.post("/api/ai/generate", async (req, res) => {
  const { topic, grade, wordsCount = 5 } = req.body;
  try {
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Tham số 'topic' là bắt buộc." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      console.warn("GEMINI_API_KEY is not defined, returning robust local generated set.");
      const fallbackList = getFallbackVocabulary(topic, wordsCount);
      return res.json(fallbackList);
    }

    const prompt = `Generate a JSON array of exactly ${wordsCount} English vocabulary words for topic: "${topic}" targeted for students at grade level: "${grade || 'primary school'}". 
    Each word item MUST have the following attributes:
    1. "term": English word or short phrase.
    2. "meaning": Vietnamese meaning.
    3. "ipa": Standard IPA phonetic transcription.
    4. "pos": Part of speech (e.g., Noun, Verb, Adjective, Adverb, Phrase).
    5. "example": A simple English example sentence.
    6. "exampleMeaning": Vietnamese translation of that example.
    
    Make sure example sentences are easy to understand for the specified grade level.
    Return ONLY valid JSON. Avoid markdown blocks like \`\`\`json.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              meaning: { type: Type.STRING },
              ipa: { type: Type.STRING },
              pos: { type: Type.STRING },
              example: { type: Type.STRING },
              exampleMeaning: { type: Type.STRING }
            },
            required: ["term", "meaning", "ipa", "pos", "example", "exampleMeaning"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "[]");
    res.json(parsedData);
  } catch (error: any) {
    console.warn("AI generation service temporarily unavailable, activating fallback set generator:", error.message);
    const fallbackList = getFallbackVocabulary(topic, wordsCount);
    res.json(fallbackList);
  }
});

// GET: All Vocab Sets with filtering
app.get("/api/vocab-sets", (req, res) => {
  const db = readDb();
  const { search, tag, grade, status } = req.query;

  let filtered = [...db.vocabSets];

  if (search) {
    const s = (search as string).toLowerCase();
    filtered = filtered.filter(
      (set) =>
        set.title.toLowerCase().includes(s) ||
        set.description.toLowerCase().includes(s) ||
        set.subject.toLowerCase().includes(s)
    );
  }

  if (tag) {
    filtered = filtered.filter((set) => set.tags.includes(tag as string));
  }

  if (grade) {
    filtered = filtered.filter((set) => set.gradeLevel === grade);
  }

  if (status) {
    filtered = filtered.filter((set) => set.status === status);
  }

  res.json(filtered);
});

// GET: Single Vocab Set
app.get("/api/vocab-sets/:id", (req, res) => {
  const db = readDb();
  const set = db.vocabSets.find((s) => s.id === req.params.id);
  if (!set) {
    return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
  }
  res.json(set);
});

// POST: Create Vocab Set
app.post("/api/vocab-sets", (req, res) => {
  const db = readDb();
  const newSet = {
    ...req.body,
    id: `set-${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  db.vocabSets.unshift(newSet);
  writeDb(db);
  res.status(201).json(newSet);
});

// PUT: Update Vocab Set
app.put("/api/vocab-sets/:id", (req, res) => {
  const db = readDb();
  const index = db.vocabSets.findIndex((s) => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
  }

  db.vocabSets[index] = {
    ...db.vocabSets[index],
    ...req.body,
    id: req.params.id // Prevent id modification
  };

  writeDb(db);
  res.json(db.vocabSets[index]);
});

// DELETE: Delete Vocab Set
app.delete("/api/vocab-sets/:id", (req, res) => {
  const db = readDb();
  const index = db.vocabSets.findIndex((s) => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
  }

  db.vocabSets.splice(index, 1);
  // Also clean up any related assignments
  db.assignments = db.assignments.filter((a) => a.vocabSetId !== req.params.id);

  writeDb(db);
  res.json({ success: true, message: "Xóa bộ từ vựng thành công." });
});

// POST: Clone Vocab Set
app.post("/api/vocab-sets/:id/clone", (req, res) => {
  const db = readDb();
  const set = db.vocabSets.find((s) => s.id === req.params.id);
  if (!set) {
    return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
  }

  const clonedSet = {
    ...set,
    id: `set-${Date.now()}`,
    title: `${set.title} (Nhân bản)`,
    status: "draft",
    createdAt: new Date().toISOString()
  };

  db.vocabSets.unshift(clonedSet);
  writeDb(db);
  res.status(201).json(clonedSet);
});

// --- CLASS ENDPOINTS ---
app.get("/api/classes", (req, res) => {
  const db = readDb();
  res.json(db.classes);
});

app.get("/api/class-members", (req, res) => {
  const db = readDb();
  res.json(db.classMembers || []);
});

app.post("/api/classes", (req, res) => {
  const db = readDb();
  const newClass = {
    ...req.body,
    id: `class-${Date.now()}`,
    code: Math.random().toString(36).substring(2, 8).toUpperCase()
  };
  db.classes.push(newClass);
  writeDb(db);
  res.status(201).json(newClass);
});

app.get("/api/classes/:classId/members", (req, res) => {
  const db = readDb();
  const members = db.classMembers.filter((m) => m.classId === req.params.classId);
  res.json(members);
});

app.post("/api/classes/:classId/members", (req, res) => {
  const db = readDb();
  const newMember = {
    id: `member-${Date.now()}`,
    classId: req.params.classId,
    studentName: req.body.studentName
  };
  db.classMembers.push(newMember);
  writeDb(db);
  res.status(201).json(newMember);
});

app.delete("/api/classes/:classId/members/:memberId", (req, res) => {
  const db = readDb();
  db.classMembers = db.classMembers.filter(
    (m) => !(m.classId === req.params.classId && m.id === req.params.memberId)
  );
  writeDb(db);
  res.json({ success: true });
});

app.delete("/api/classes/:id", (req, res) => {
  const db = readDb();
  db.classes = db.classes.filter((c) => c.id !== req.params.id);
  // Also clean up members and assignments for this class
  db.classMembers = db.classMembers.filter((m) => m.classId !== req.params.id);
  db.assignments = db.assignments.filter((a) => a.classId !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// --- ASSIGNMENTS ---
app.get("/api/assignments", (req, res) => {
  const db = readDb();
  res.json(db.assignments);
});

app.post("/api/assignments", (req, res) => {
  const db = readDb();
  const newAssign = {
    ...req.body,
    id: `assign-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  db.assignments.unshift(newAssign);
  writeDb(db);
  res.status(201).json(newAssign);
});

app.delete("/api/assignments/:id", (req, res) => {
  const db = readDb();
  db.assignments = db.assignments.filter((a) => a.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// --- GAME SESSIONS & RESULTS ---
app.post("/api/game-sessions", (req, res) => {
  const db = readDb();
  const newSession = {
    ...req.body,
    id: `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0
  };
  db.gameSessions.push(newSession);
  writeDb(db);
  res.status(201).json(newSession);
});

app.put("/api/game-sessions/:id", (req, res) => {
  const db = readDb();
  const index = db.gameSessions.findIndex((s) => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Session không tồn tại." });
  }

  db.gameSessions[index] = {
    ...db.gameSessions[index],
    ...req.body,
    completedAt: new Date().toISOString()
  };

  writeDb(db);
  res.json(db.gameSessions[index]);
});

app.get("/api/results", (req, res) => {
  const db = readDb();
  // Return completed game sessions as results
  const completed = db.gameSessions.filter((s) => s.completedAt);
  res.json(completed);
});

// ============================================================================
// VITE OR STATIC SERVING MIDDLEWARE
// ============================================================================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Start Vite in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded as middleware.");
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
