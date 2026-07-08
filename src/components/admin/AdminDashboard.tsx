import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Copy, Search, Filter, BookOpen, Layers, Users, 
  Calendar, Award, Sparkles, Check, Play, RefreshCw, Send, AlertCircle, ListPlus, Volume2,
  Shield, FileText, Lock, Unlock, Star, X
} from 'lucide-react';
import { VocabSet, VocabItem, Class, ClassMember, Assignment, GameSession, TtsSettings } from '../../types';
import { GAMES_LIST } from '../../lib/game-engine/gameList';
import { speakEnglish } from '../../lib/game-engine/speech';
import { useAuth } from '../../context/AuthContext';
import { getLeaderboardByCategory, LeaderboardCategory, LeaderboardPeriod } from '../../lib/leaderboard';

interface AdminDashboardProps {
  onViewAsStudent: (set: VocabSet, gameId?: string, assignmentId?: string) => void;
}

type AdminTab = 'dashboard' | 'vocab-sets' | 'editor' | 'classes' | 'assignments' | 'results' | 'users' | 'audit-logs';
type VocabVisibility = 'public' | 'assignment' | 'draft';

const getSetVisibility = (set: VocabSet): VocabVisibility => {
  if (set.visibility === 'public' || set.visibility === 'assignment' || set.visibility === 'draft') {
    return set.visibility;
  }
  if (set.status === 'private') return 'assignment';
  if (set.status === 'public') return 'public';
  return 'draft';
};

const getAssignmentLink = (set: VocabSet) => {
  const token = set.shareToken || set.assignmentSlug;
  return token ? `${window.location.origin}/assignment/${token}` : '';
};

const DEFAULT_TTS_SETTINGS: TtsSettings = {
  autoGenerate: true,
  provider: 'ai33',
  voice: 'edge_en-US-AriaNeural',
  lang: 'en-US',
  speed: 1
};

const TTS_VOICE_OPTIONS = [
  { value: 'edge_en-US-AriaNeural', label: 'Edge Aria - en-US' },
  { value: 'edge_en-US-JennyNeural', label: 'Edge Jenny - en-US' },
  { value: 'edge_en-GB-SoniaNeural', label: 'Edge Sonia - en-GB' },
  { value: 'edge_en-GB-RyanNeural', label: 'Edge Ryan - en-GB' }
];

const DEFAULT_GRADE_OPTIONS = ['Lớp 3', 'Lớp 6', 'Lớp 10'];

function formatVietnamDateTime(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(totalSeconds?: number) {
  const secs = Math.max(0, Math.round(totalSeconds || 0));
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}

function getSessionEndTime(session: GameSession) {
  return session.endedAt || session.completedAt;
}

export default function AdminDashboard({ onViewAsStudent }: AdminDashboardProps) {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [vocabSets, setVocabSets] = useState<VocabSet[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<GameSession[]>([]);

  // Super Admin States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');
  
  // Searching/Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('week');
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('gold');
  const [leaderboardClassId, setLeaderboardClassId] = useState('');
  const [leaderboardVocabSetId, setLeaderboardVocabSetId] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<GameSession | null>(null);

  // Class Roster dynamic input states
  const [newMemberNames, setNewMemberNames] = useState<Record<string, string>>({});

  // Active Vocab Set Editor State
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorSubject, setEditorSubject] = useState('English');
  const [editorGrade, setEditorGrade] = useState('Lớp 3');
  const [editorStatus, setEditorStatus] = useState<VocabVisibility>('public');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorItems, setEditorItems] = useState<VocabItem[]>([]);
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [isPreviewingTts, setIsPreviewingTts] = useState(false);
  const [ttsQueuedSetId, setTtsQueuedSetId] = useState<string | null>(null);

  // Quick Batch Add States
  const [batchTerms, setBatchTerms] = useState('');
  const [batchMeanings, setBatchMeanings] = useState('');
  const [batchIpas, setBatchIpas] = useState('');
  const [batchPartsOfSpeech, setBatchPartsOfSpeech] = useState('');
  const [batchExamples, setBatchExamples] = useState('');
  const [batchExampleMeanings, setBatchExampleMeanings] = useState('');

  // AI Generation States
  const [aiTopic, setAiTopic] = useState('');
  const [aiGrade, setAiGrade] = useState('Lớp 3');
  const [aiCount, setAiCount] = useState(5);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // New Class State
  const [newClassName, setNewClassName] = useState('');
  
  // New Assignment States
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSetId, setAssignSetId] = useState('');
  const [assignGameId, setAssignGameId] = useState('flashcard-en-vi');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTitle, setAssignTitle] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [shareLinkNotice, setShareLinkNotice] = useState<{ title: string; url: string } | null>(null);

  const gradeOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_GRADE_OPTIONS,
      ...classes.map(cls => cls.name).filter(Boolean),
      ...vocabSets.map(set => set.gradeLevel).filter(Boolean),
      editorGrade
    ]));
  }, [classes, vocabSets, editorGrade]);

  const teacherDisplayName = React.useMemo(() => {
    const rawName = (user?.name || '').trim();
    if (!rawName) return 'cô';
    const firstName = rawName.split(/\s+/)[0];
    return `cô ${firstName}`;
  }, [user?.name]);

  // Authenticated custom fetch wrapper
  const authFetch = (url: string, options: any = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  // Load all initial data from our Express backend
  const refreshData = () => {
    if (!token) return;

    // Vocab Sets
    authFetch('/api/vocab-sets')
      .then(res => res.json())
      .then(data => setVocabSets(data))
      .catch(err => console.error("Error loading vocab sets:", err));

    // Classes
    authFetch('/api/classes')
      .then(res => res.json())
      .then(data => setClasses(data))
      .catch(err => console.error("Error loading classes:", err));

    // Class Members
    authFetch('/api/class-members')
      .then(res => res.json())
      .then(data => setClassMembers(data))
      .catch(err => console.error("Error loading class members:", err));

    // Assignments
    authFetch('/api/assignments')
      .then(res => res.json())
      .then(data => setAssignments(data))
      .catch(err => console.error("Error loading assignments:", err));

    // Game Results (Completed sessions)
    authFetch('/api/results')
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(err => console.error("Error loading results:", err));

    // Load users & audit logs if user is super_admin
    if (user?.role === 'super_admin') {
      authFetch('/api/admin/users')
        .then(res => res.json())
        .then(data => setUsersList(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error loading admin users:", err));

      authFetch('/api/admin/audit-logs')
        .then(res => res.json())
        .then(data => setAuditLogs(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error loading admin logs:", err));
    }
  };

  useEffect(() => {
    refreshData();
  }, [token, user]);


  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- EDITOR FUNCTIONS ---
  const handleOpenNewEditor = () => {
    setEditingSetId(null);
    setEditorTitle('');
    setEditorDescription('');
    setEditorSubject('General English');
    setEditorGrade('Lớp 3');
    setEditorStatus('public');
    setEditorTags(['basic']);
    setEditorItems([]);
    setTtsSettings(DEFAULT_TTS_SETTINGS);
    setTtsQueuedSetId(null);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    setActiveTab('editor');
  };

  const handleOpenEditEditor = (set: VocabSet) => {
    setEditingSetId(set.id);
    setEditorTitle(set.title);
    setEditorDescription(set.description);
    setEditorSubject(set.subject);
    setEditorGrade(set.gradeLevel);
    setEditorStatus(getSetVisibility(set));
    setEditorTags(set.tags);
    setEditorItems([...set.items]);
    setTtsSettings({ ...DEFAULT_TTS_SETTINGS, ...(set.ttsSettings || {}) });
    setTtsQueuedSetId(null);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    setActiveTab('editor');
  };

  const handleAddItemRow = () => {
    const newItem: VocabItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      term: '',
      meaning: '',
      ipa: '',
      pos: '',
      example: '',
      exampleMeaning: '',
      displayOrder: editorItems.length + 1
    };
    setEditorItems([...editorItems, newItem]);
  };

  const handleUpdateItemValue = (id: string, field: keyof VocabItem, value: any) => {
    setEditorItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const updateTtsSettings = (patch: Partial<TtsSettings>) => {
    setTtsSettings(prev => ({ ...prev, ...patch }));
  };

  const refreshEditorAudioStatus = async (setId: string) => {
    try {
      const res = await authFetch(`/api/vocab-sets/${setId}/audio/status`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) return;
      const byId = new Map<string, Partial<VocabItem>>(data.items.map((item: VocabItem) => [item.id, item]));
      setEditorItems(prev => prev.map(item => ({ ...item, ...(byId.get(item.id) ?? {}) })));
    } catch (err) {
      console.error("Error refreshing audio status:", err);
    }
  };

  const handlePreviewTtsVoice = async () => {
    setIsPreviewingTts(true);
    try {
      const res = await authFetch('/api/tts/preview', {
        method: 'POST',
        body: JSON.stringify({
          text: 'apple',
          settings: ttsSettings
        })
      });
      const data = await res.json();
      if (!res.ok || !data.audioUrl) {
        showNotification(data.error || 'KhÃ´ng thá»ƒ táº¡o audio nghe thá»­.', 'error');
        return;
      }
      new Audio(data.audioUrl).play().catch(() => showNotification('TrÃ¬nh duyá»‡t cháº·n phÃ¡t audio nghe thá»­.', 'error'));
    } catch (err: any) {
      showNotification(err.message || 'KhÃ´ng thá»ƒ nghe thá»­ giá»ng.', 'error');
    } finally {
      setIsPreviewingTts(false);
    }
  };

  const handlePlayItemAudio = (item: VocabItem) => {
    if (item.audioUrl) {
      new Audio(item.audioUrl).play().catch(() => speakEnglish(item.term));
      return;
    }
    if (item.term.trim()) speakEnglish(item.term);
  };

  const handleGenerateItemAudio = async (itemId: string, force = false) => {
    if (!editingSetId) {
      showNotification('HÃ£y lÆ°u bá»™ tá»« trÆ°á»›c khi táº¡o audio riÃªng cho tá»« nÃ y.', 'error');
      return;
    }
    setEditorItems(prev => prev.map(item => item.id === itemId ? { ...item, audioStatus: 'queued', audioError: '' } : item));
    try {
      const res = await authFetch(`/api/vocab-sets/${editingSetId}/audio/generate-missing`, {
        method: 'POST',
        body: JSON.stringify({
          settings: ttsSettings,
          itemIds: [itemId],
          force
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'KhÃ´ng thá»ƒ xáº¿p hÃ ng táº¡o audio.', 'error');
        return;
      }
      showNotification('ÄÃ£ xáº¿p hÃ ng táº¡o audio cho tá»« nÃ y.');
      setTimeout(() => refreshEditorAudioStatus(editingSetId), 2500);
    } catch (err: any) {
      showNotification(err.message || 'KhÃ´ng thá»ƒ táº¡o audio.', 'error');
    }
  };

  const handleDeleteItemRow = (id: string) => {
    setEditorItems(prev => prev.filter(item => item.id !== id));
  };

  // Batch import text converter (Ghép nhanh nhiều dòng)
  const handleProcessBatchAdd = () => {
    const splitLines = (value: string) => value.split('\n').map(line => line.trim());
    const terms = splitLines(batchTerms);
    const meanings = splitLines(batchMeanings);
    const ipas = splitLines(batchIpas);
    const partsOfSpeech = splitLines(batchPartsOfSpeech);
    const examples = splitLines(batchExamples);
    const exampleMeanings = splitLines(batchExampleMeanings);
    const nonEmptyTerms = terms.filter(Boolean);
    const nonEmptyMeanings = meanings.filter(Boolean);

    if (nonEmptyTerms.length === 0 || nonEmptyMeanings.length === 0) {
      showNotification("Hãy nhập dữ liệu từ và nghĩa trước khi ghép.", "error");
      return;
    }

    const linesCount = Math.max(
      terms.length,
      meanings.length,
      ipas.length,
      partsOfSpeech.length,
      examples.length,
      exampleMeanings.length
    );
    const importedItems: VocabItem[] = [];

    for (let i = 0; i < linesCount; i++) {
      if (!terms[i] && !meanings[i]) continue;

      importedItems.push({
        id: `item-${Date.now()}-${i}`,
        term: terms[i] || '',
        meaning: meanings[i] || nonEmptyMeanings[nonEmptyMeanings.length - 1] || '',
        ipa: ipas[i] || '',
        pos: partsOfSpeech[i] || '',
        example: examples[i] || '',
        exampleMeaning: exampleMeanings[i] || '',
        displayOrder: editorItems.length + i + 1
      });
    }

    setEditorItems([...editorItems, ...importedItems]);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    showNotification(`Đã ghép thành công ${importedItems.length} từ vựng vào bảng.`);
  };

  const applyMissingVocabDetails = (itemId: string, details: Partial<VocabItem>) => {
    setEditorItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        meaning: item.meaning.trim() ? item.meaning : (details.meaning || item.meaning),
        ipa: item.ipa.trim() ? item.ipa : (details.ipa || item.ipa),
        pos: item.pos.trim() ? item.pos : (details.pos || item.pos),
        example: item.example.trim() ? item.example : (details.example || item.example),
        exampleMeaning: item.exampleMeaning.trim() ? item.exampleMeaning : (details.exampleMeaning || item.exampleMeaning),
        audioUrl: item.audioUrl || details.audioUrl
      };
    }));
  };

  const hasMissingGeneratedFields = (item: VocabItem) => {
    return !item.meaning.trim() ||
      !item.ipa.trim() ||
      !item.pos.trim() ||
      !item.example.trim() ||
      !item.exampleMeaning.trim() ||
      !item.audioUrl;
  };

  // Auto-fill missing row details using server proxy AI API
  const handleGenerateIpaForRow = async (id: string, term: string) => {
    if (!term.trim()) return;
    try {
      const currentItem = editorItems.find(item => item.id === id);
      const res = await authFetch('/api/ai/vocab-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: term,
          meaning: currentItem?.meaning || '',
          grade: editorGrade
        })
      });
      const data = await res.json();
      if (res.ok) {
        applyMissingVocabDetails(id, data);
        if (data.isFallback) {
          showNotification("Gemini và OpenAI đều chưa sinh được dữ liệu thật. Hệ thống đã dùng dữ liệu dự phòng tạm thời.", "error");
        }
      }
    } catch (err) {
      console.error("Error generating vocabulary details:", err);
    }
  };

  const handleGenerateAllBlankIpas = async () => {
    let count = 0;
    let fallbackCount = 0;
    const itemsWithMissingDetails = editorItems.filter(item => item.term.trim() && hasMissingGeneratedFields(item));
    if (itemsWithMissingDetails.length === 0) {
      showNotification("Tất cả các từ trong bảng đều đã đủ IPA, loại từ, ví dụ và dịch nghĩa ví dụ.");
      return;
    }

    showNotification("Đang tự sinh các phần còn thiếu bằng AI...");
    for (const item of itemsWithMissingDetails) {
      try {
        const res = await authFetch('/api/ai/vocab-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: item.term,
            meaning: item.meaning,
            grade: editorGrade
          })
        });
        const data = await res.json();
        if (res.ok) {
          applyMissingVocabDetails(item.id, data);
          if (data.isFallback) fallbackCount++;
          count++;
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (fallbackCount > 0) {
      showNotification(`Đã bổ sung ${count} từ, nhưng ${fallbackCount} từ phải dùng dữ liệu dự phòng vì Gemini/OpenAI đều lỗi hoặc hết quota.`, "error");
    } else {
      showNotification(`Đã tự động bổ sung thông tin cho ${count} từ vựng.`);
    }
  };

  // AI Vocab set generator (Tích hợp thực tế với Gemini)
  const handleGenerateSetByAI = async () => {
    if (!aiTopic.trim()) {
      showNotification("Hãy nhập chủ đề để AI tạo từ vựng.", "error");
      return;
    }

    setIsAiGenerating(true);
    showNotification("Hệ thống Gemini đang tạo bộ từ vựng thông minh cho em...");

    try {
      const res = await authFetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          grade: aiGrade,
          wordsCount: aiCount
        })
      });
      const data = await res.json();

      if (res.ok && Array.isArray(data)) {
        const fallbackCount = data.filter((word: any) => word.isFallback).length;
        const generated: VocabItem[] = data.map((word: any, i: number) => ({
          id: `ai-item-${Date.now()}-${i}`,
          term: word.term || '',
          meaning: word.meaning || '',
          ipa: word.ipa || '',
          pos: word.pos || 'Noun',
          example: word.example || '',
          exampleMeaning: word.exampleMeaning || '',
          displayOrder: editorItems.length + i + 1
        }));

        setEditorItems([...editorItems, ...generated]);
        setAiTopic('');
        if (fallbackCount > 0) {
          showNotification(`Đã tạo ${generated.length} từ, nhưng ${fallbackCount} từ đang dùng dữ liệu dự phòng vì Gemini/OpenAI đều lỗi hoặc hết quota.`, "error");
        } else {
          showNotification(`Đã sử dụng AI tạo thành công ${generated.length} từ vựng thuộc chủ đề "${aiTopic}"!`);
        }
      } else {
        showNotification(data.error || "Không thể tạo từ vựng bằng AI. Hãy thử lại.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("Lỗi kết nối AI: " + err.message, "error");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveSet = () => {
    if (!editorTitle.trim()) {
      showNotification("Hãy điền tên bộ từ vựng.", "error");
      return;
    }

    if (editorItems.length === 0) {
      showNotification("Danh sách từ vựng trống. Hãy thêm ít nhất một từ.", "error");
      return;
    }

    const payload = {
      title: editorTitle,
      description: editorDescription,
      subject: editorSubject,
      gradeLevel: editorGrade,
      visibility: editorStatus,
      status: editorStatus === 'assignment' ? 'private' : editorStatus,
      tags: editorTags,
      createdBy: user?.id || "teacher-1",
      creatorName: user?.name || "Cô Thảo English",
      ttsSettings,
      items: editorItems.map((item, idx) => ({ ...item, displayOrder: idx + 1 }))
    };

    const url = editingSetId ? `/api/vocab-sets/${editingSetId}` : '/api/vocab-sets';
    const method = editingSetId ? 'PUT' : 'POST';

    authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      showNotification("Lưu bộ từ vựng thành công!");
      const savedVisibility = getSetVisibility(data);
      const assignmentUrl = getAssignmentLink(data);
      if (savedVisibility === 'assignment' && assignmentUrl) {
        setShareLinkNotice({ title: data.title, url: assignmentUrl });
      } else {
        setShareLinkNotice(null);
      }
      if (ttsSettings.autoGenerate && data.id) {
        setTtsQueuedSetId(data.id);
        showNotification("LÆ°u bá»™ tá»« thÃ nh cÃ´ng. Audio phÃ¡t Ã¢m Ä‘ang Ä‘Æ°á»£c táº¡o ná»n.");
        setTimeout(() => refreshEditorAudioStatus(data.id), 3000);
      }
      refreshData();
      setActiveTab('vocab-sets');
    })
    .catch(err => {
      console.error(err);
      showNotification("Không thể lưu bộ từ vựng.", "error");
    });
  };

  // --- CRUD VOCAB LIST ACTIONS ---
  const handleCloneSet = (id: string) => {
    authFetch(`/api/vocab-sets/${id}/clone`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        showNotification(`Đã sao chép bộ từ vựng thành công.`);
        refreshData();
      })
      .catch(err => console.error(err));
  };

  const handleDeleteSet = (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bộ từ vựng này? Hành động này cũng sẽ gỡ bỏ tất cả bài giao tương ứng.")) return;
    
    authFetch(`/api/vocab-sets/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        showNotification("Đã xóa bộ từ vựng thành công.");
        refreshData();
      })
      .catch(err => console.error(err));
  };

  // --- CLASSES MANAGER ---
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    authFetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newClassName,
        teacherId: user?.id || "teacher-1"
      })
    })
    .then(res => res.json())
    .then(data => {
      showNotification(`Tạo lớp "${data.name}" thành công với mã mời: ${data.code}`);
      setNewClassName('');
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleAddClassMember = (classId: string, e: React.FormEvent) => {
    e.preventDefault();
    const studentName = newMemberNames[classId]?.trim();
    if (!studentName) return;

    authFetch(`/api/classes/${classId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName })
    })
    .then(res => res.json())
    .then(data => {
      showNotification(`Đã thêm học sinh "${data.studentName}" vào lớp thành công.`);
      setNewMemberNames(prev => ({ ...prev, [classId]: '' }));
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleDeleteClassMember = (classId: string, memberId: string, studentName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi lớp?`)) return;

    authFetch(`/api/classes/${classId}/members/${memberId}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showNotification(`Đã xóa học sinh khỏi lớp.`);
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleDeleteClass = (id: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"? Hành động này sẽ gỡ bỏ tất cả học sinh và bài tập đã giao.`)) return;

    authFetch(`/api/classes/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showNotification(`Đã xóa lớp "${className}" thành công.`);
      refreshData();
    })
    .catch(err => console.error(err));
  };

  // --- ASSIGNMENTS SCHEDULER ---
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSetId || !assignDueDate) {
      showNotification("Vui lòng điền đủ thông tin giao bài.", "error");
      return;
    }

    const selectedClass = classes.find(c => c.id === assignClassId);
    const selectedSet = vocabSets.find(s => s.id === assignSetId);

    if (!selectedClass || !selectedSet) return;

    const payload = {
      classId: assignClassId,
      className: selectedClass.name,
      vocabSetId: assignSetId,
      vocabSetTitle: selectedSet.title,
      gameId: assignGameId,
      dueDate: assignDueDate,
      createdBy: user?.id || "teacher-1",
      title: assignTitle.trim() || `Học từ vựng: ${selectedSet.title}`
    };

    authFetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      showNotification("Giao bài tập cho học sinh lớp thành công!");
      setAssignClassId('');
      setAssignSetId('');
      setAssignDueDate('');
      setAssignTitle('');
      refreshData();
      setActiveTab('assignments');
    })
    .catch(err => console.error(err));
  };

  const handleDeleteAssignment = (id: string) => {
    authFetch(`/api/assignments/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        showNotification("Đã thu hồi bài giao thành công.");
        refreshData();
      })
      .catch(err => console.error(err));
  };

  // --- FILTERED SETS LIST ---
  const filteredSets = vocabSets.filter(set => {
    const matchesSearch = set.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          set.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          set.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = filterGrade ? set.gradeLevel === filterGrade : true;
    const matchesStatus = filterStatus ? getSetVisibility(set) === filterStatus : true;
    return matchesSearch && matchesGrade && matchesStatus;
  });

  const leaderboardRows = React.useMemo(() => {
    return getLeaderboardByCategory(
      results,
      assignments,
      {
        period: leaderboardPeriod,
        classId: leaderboardClassId || undefined,
        vocabSetId: leaderboardVocabSetId || undefined
      },
      leaderboardCategory
    );
  }, [results, assignments, leaderboardPeriod, leaderboardClassId, leaderboardVocabSetId, leaderboardCategory]);

  const recentResults = React.useMemo(() => {
    return [...results]
      .filter(res => getSessionEndTime(res))
      .sort((a, b) => new Date(getSessionEndTime(b) || 0).getTime() - new Date(getSessionEndTime(a) || 0).getTime())
      .slice(0, 10);
  }, [results]);

  const dashboardGoldRows = React.useMemo(() => {
    return getLeaderboardByCategory(results, assignments, { period: 'week' }, 'gold').slice(0, 5);
  }, [results, assignments]);

  const leaderboardTitleMap: Record<LeaderboardCategory, string> = {
    gold: 'Bảng vàng tuần này',
    diligent: 'Chăm chỉ nhất',
    accurate: 'Chính xác nhất',
    improved: 'Tiến bộ nhất'
  };

  // --- SUPER ADMIN ACCOUNT MANAGEMENT ---
  const handleUpdateUserRole = (userId: string, newRole: string) => {
    authFetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showNotification(data.error, "error");
      } else {
        showNotification(data.customClaimWarning
          ? "Đã cập nhật vai trò trong hệ thống. Nếu tài khoản chưa thấy quyền mới, hãy đăng xuất rồi đăng nhập lại."
          : "Cập nhật vai trò người dùng thành công!");
        refreshData();
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("Không thể cập nhật vai trò người dùng.", "error");
    });
  };

  const handleToggleUserStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    authFetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showNotification(data.error, "error");
      } else {
        showNotification(newStatus === 'blocked' ? "Đã khóa tài khoản thành công!" : "Đã mở khóa tài khoản thành công!");
        refreshData();
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("Không thể cập nhật trạng thái tài khoản.", "error");
    });
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                          (u.phone || '').toLowerCase().includes(usersSearch.toLowerCase());
    const matchesRole = usersRoleFilter ? u.role === usersRoleFilter : true;
    const matchesStatus = usersStatusFilter ? u.status === usersStatusFilter : true;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50/50" id="admin-dashboard-container">
      
      {/* Toast Alert pop-up */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center space-x-2 border transition-all text-sm font-semibold ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-rose-50 border-rose-100 text-rose-800'
        }`} id="admin-toast">
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {shareLinkNotice && (
        <div className="fixed top-20 right-4 z-50 w-[min(92vw,420px)] bg-white border border-indigo-100 rounded-3xl shadow-xl p-4 space-y-3" id="assignment-link-panel">
          <div>
            <p className="text-[10px] font-black uppercase text-indigo-500">Link giao bài riêng</p>
            <p className="text-sm font-extrabold text-gray-800 truncate">{shareLinkNotice.title}</p>
          </div>
          <div className="flex gap-2">
            <input
              value={shareLinkNotice.url}
              readOnly
              className="min-w-0 flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2 text-xs font-semibold text-gray-600"
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareLinkNotice.url);
                showNotification("Đã copy link giao bài.");
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition-all"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setShareLinkNotice(null)}
            className="text-xs font-bold text-gray-400 hover:text-gray-700"
          >
            Đóng
          </button>
        </div>
      )}

      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" id="activity-detail-modal">
          <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden bg-white rounded-3xl border border-gray-200 shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase text-blue-600">Chi tiết lượt luyện tập</p>
                <h3 className="mt-1 text-xl font-black text-gray-900">
                  {selectedActivity.studentName} • {selectedActivity.gameName || GAMES_LIST.find(g => g.gameId === selectedActivity.gameId)?.title || selectedActivity.gameId}
                </h3>
                <p className="text-xs font-semibold text-gray-500">{selectedActivity.vocabSetTitle}</p>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                aria-label="Đóng chi tiết hoạt động"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase text-blue-600">Điểm</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedActivity.score}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Đúng / Tổng</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedActivity.correctAnswers}/{selectedActivity.totalQuestions}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase text-amber-700">Độ chính xác</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedActivity.accuracy ?? Math.round((selectedActivity.correctAnswers / Math.max(1, selectedActivity.totalQuestions)) * 100)}%</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase text-slate-600">Thời lượng</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{formatDuration(selectedActivity.durationSeconds || Math.round((selectedActivity.durationMs || 0) / 1000))}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase text-gray-400">Bắt đầu</p>
                  <p className="mt-1 font-bold text-gray-800">{formatVietnamDateTime(selectedActivity.startedAt)}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase text-gray-400">Kết thúc</p>
                  <p className="mt-1 font-bold text-gray-800">{formatVietnamDateTime(getSessionEndTime(selectedActivity))}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="text-sm font-black text-gray-900">Danh sách câu trả lời</h4>
                  <span className="text-xs font-bold text-gray-500">{selectedActivity.answerDetails?.length || 0} dòng</span>
                </div>

                {!selectedActivity.answerDetails || selectedActivity.answerDetails.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    Lượt chơi này chưa có dữ liệu chi tiết từng câu.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white">
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">#</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Câu hỏi</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Học sinh chọn</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Đáp án đúng</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedActivity.answerDetails.map((detail, index) => (
                          <tr key={`${selectedActivity.id}-detail-${index}`} className="border-t border-gray-100">
                            <td className="p-3 text-xs font-bold text-gray-500">{detail.questionIndex + 1 || index + 1}</td>
                            <td className="p-3">
                              <p className="text-sm font-bold text-gray-900">{detail.questionText || detail.word || '--'}</p>
                              {detail.wordId && <p className="text-[10px] font-mono text-gray-400">{detail.wordId}</p>}
                              {detail.options && detail.options.length > 0 && (
                                <p className="mt-1 text-[10px] text-gray-500">Lựa chọn: {detail.options.join(' | ')}</p>
                              )}
                            </td>
                            <td className="p-3 text-sm font-semibold text-gray-700">{detail.userAnswer || detail.selectedAnswer || '--'}</td>
                            <td className="p-3 text-sm font-semibold text-gray-700">{detail.correctAnswer || '--'}</td>
                            <td className="p-3">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                                detail.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {detail.isCorrect ? 'Đúng' : 'Sai'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Left Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-col shrink-0" id="admin-sidebar">
        
        {/* Brand Banner */}
        <div className="p-6 border-b border-gray-50 flex items-center space-x-3">
          <span className="p-2 bg-indigo-600 text-white rounded-2xl shadow-md shrink-0">
            <BookOpen size={20} />
          </span>
          <div>
            <h1 className="font-black text-gray-800 tracking-tight text-base leading-snug">Cô Diệu Tiếng Anh</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {user?.role === 'super_admin' ? 'Hệ thống Admin' : 'Dashboard Giáo Viên'}
            </p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-4 flex-1 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-dashboard"
          >
            <Layers size={18} />
            <span>Tổng quan</span>
          </button>
          
          <button
            onClick={() => setActiveTab('vocab-sets')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'vocab-sets' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-sets"
          >
            <BookOpen size={18} />
            <span>Kho từ vựng</span>
          </button>

          <button
            onClick={handleOpenNewEditor}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'editor' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-editor"
          >
            <Plus size={18} />
            <span>Soạn từ vựng mới</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'classes' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-classes"
          >
            <Users size={18} />
            <span>Quản lý Lớp học</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'results' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-results"
          >
            <Award size={18} />
            <span>Bảng vàng học sinh</span>
          </button>

          {/* SUPER ADMIN ONLY TABS */}
          {user?.role === 'super_admin' && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
                id="tab-users"
              >
                <Shield size={18} className="text-amber-500" />
                <span>Quản lý Tài khoản</span>
              </button>

              <button
                onClick={() => setActiveTab('audit-logs')}
                className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'audit-logs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
                id="tab-audit-logs"
              >
                <FileText size={18} className="text-amber-500" />
                <span>Nhật ký hệ thống</span>
              </button>
            </>
          )}
        </nav>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold shrink-0">
              {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-800 truncate">{user?.name || 'Hệ thống Admin'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email || 'admin@vocabulary.edu.vn'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl overflow-x-hidden" id="admin-main-panel">

        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ==================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in" id="dashboard-tab-content">
            
            {/* Greetings Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Xin chào, {teacherDisplayName}!</h2>
                <p className="text-gray-400 text-sm font-medium">Hôm nay hãy cùng các học sinh học thật nhiều từ vựng mới nhé.</p>
              </div>
              <button
                onClick={handleOpenNewEditor}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center space-x-2 cursor-pointer active:scale-95 text-sm"
              >
                <Plus size={16} />
                <span>Soạn bộ từ mới</span>
              </button>
            </div>

            {/* Quick Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                  <BookOpen size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">BỘ TỪ VỰNG</span>
                  <span className="text-2xl font-black text-gray-800">{vocabSets.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <Users size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LỚP HỌC</span>
                  <span className="text-2xl font-black text-gray-800">{classes.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <Star size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">HỌC SINH VINH DANH</span>
                  <span className="text-2xl font-black text-gray-800">{dashboardGoldRows.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                  <Award size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LƯỢT HOÀN THÀNH</span>
                  <span className="text-2xl font-black text-gray-800">{results.length}</span>
                </div>
              </div>
            </div>

            {/* Recent activity grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Recent Student Results */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Hoạt động luyện tập gần đây</h3>
                  <button onClick={() => setActiveTab('results')} className="text-xs font-bold text-indigo-600 hover:underline">Xem tất cả</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {recentResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Chưa có học sinh nào hoàn thành trò chơi.</div>
                  ) : (
                    recentResults.map((res) => (
                      <button
                        key={res.id}
                        onClick={() => setSelectedActivity(res)}
                        className="w-full p-3.5 bg-gray-50/50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl flex justify-between items-start text-left transition-all"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <strong className="text-sm font-bold text-gray-800">{res.studentName}</strong>
                          <p className="text-xs text-gray-500">Chơi {res.gameName || GAMES_LIST.find(g => g.gameId === res.gameId)?.title || res.gameId}</p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{res.vocabSetTitle}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                            <span>Bắt đầu: {formatVietnamDateTime(res.startedAt)}</span>
                            <span>Kết thúc: {formatVietnamDateTime(getSessionEndTime(res))}</span>
                            <span>Thời lượng: {formatDuration(res.durationSeconds || Math.round((res.durationMs || 0) / 1000))}</span>
                            <span>Trạng thái: Hoàn thành</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2.5 py-1 text-xs font-black rounded-full ${
                            res.score >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {res.score} điểm
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-1">Đúng: {res.correctAnswers}/{res.totalQuestions}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Golden Board Quick Summary */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Bảng vàng tuần này</h3>
                  <button onClick={() => setActiveTab('results')} className="text-xs font-bold text-indigo-600 hover:underline">Xem bảng vàng</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {dashboardGoldRows.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Chưa có dữ liệu để vinh danh học sinh.</div>
                  ) : (
                    dashboardGoldRows.map((entry, index) => (
                      <div key={`${entry.studentName}-${index}`} className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl flex justify-between items-center">
                        <div className="space-y-0.5">
                          <strong className="text-sm font-bold text-gray-800">{index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : ''}{entry.studentName}</strong>
                          <p className="text-xs text-indigo-600 font-semibold">{entry.completedLessons} bài hoàn thành • {entry.averageAccuracy}% đúng</p>
                          <p className="text-[10px] text-gray-400 font-mono">{entry.badges[0]}</p>
                        </div>
                        <span className="px-2.5 py-1 text-xs font-black rounded-full bg-amber-50 text-amber-700">
                          {entry.honorScore}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: VOCAB SETS DIRECTORY */}
        {/* ==================================================================== */}
        {activeTab === 'vocab-sets' && (
          <div className="space-y-6 animate-fade-in" id="sets-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Kho từ vựng của tôi</h2>
                <p className="text-gray-400 text-sm">Nơi lưu trữ và soạn thảo các bộ thẻ từ vựng để giao cho học sinh.</p>
              </div>
              <button
                onClick={handleOpenNewEditor}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Plus size={18} />
                <span>Soạn bộ từ mới</span>
              </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bộ từ vựng theo tên, mô tả, môn học..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3.5 pl-11 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 border border-gray-100 focus:border-indigo-400 font-semibold text-sm"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Lớp học</option>
                  {gradeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Trạng thái</option>
                  <option value="public">Công khai</option>
                  <option value="draft">Bản nháp</option>
                  <option value="assignment">Giao bài tập bằng link riêng</option>
                </select>
              </div>
            </div>

            {/* Grid list of sets */}
            {filteredSets.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-medium">
                Không tìm thấy bộ từ vựng nào khớp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="sets-grid">
                {filteredSets.map((set) => {
                  const visibility = getSetVisibility(set);
                  const assignmentLink = getAssignmentLink(set);
                  return (
                  <div key={set.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all flex flex-col justify-between" id={`set-card-${set.id}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {set.gradeLevel}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          visibility === 'public' ? 'bg-emerald-50 text-emerald-600' :
                          visibility === 'draft' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {visibility === 'public' ? 'CÔNG KHAI' : visibility === 'draft' ? 'BẢN NHÁP' : 'LINK RIÊNG'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-extrabold text-gray-800 text-lg leading-tight truncate-2-lines">{set.title}</h3>
                        <p className="text-xs text-gray-400 font-medium">Chủ đề: {set.subject}</p>
                        <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mt-1">{set.description}</p>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {set.tags.map((t, idx) => (
                          <span key={idx} className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">#{t}</span>
                        ))}
                      </div>
                      {visibility === 'assignment' && assignmentLink && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 space-y-2">
                          <p className="text-[10px] font-black uppercase text-indigo-500">Link giao bài</p>
                          <div className="flex gap-2">
                            <input
                              value={assignmentLink}
                              readOnly
                              className="min-w-0 flex-1 bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[11px] font-semibold text-gray-600"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(assignmentLink);
                                showNotification("Đã copy link giao bài.");
                              }}
                              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer"
                              title="Copy link giao bài"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-semibold">{set.items.length} từ vựng</span>
                      
                      <div className="flex space-x-1">
                        <button
                          onClick={() => onViewAsStudent(set)}
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                          title="Học tập"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEditEditor(set)}
                          className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all cursor-pointer"
                          title="Sửa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleCloneSet(set.id)}
                          className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all cursor-pointer"
                          title="Nhân bản"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: ADVANCED VOCAB SET EDITOR */}
        {/* ==================================================================== */}
        {activeTab === 'editor' && (
          <div className="space-y-8 animate-fade-in" id="editor-tab-content">
            
            {/* Editor Top Options */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">
                  {editingSetId ? "Chỉnh sửa bộ từ vựng" : "Soạn thảo bộ từ vựng mới"}
                </h2>
                <p className="text-gray-400 text-sm">Điền đầy đủ thông tin bên dưới hoặc nhập nhanh nhiều dòng để đưa dữ liệu vào bảng.</p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('vocab-sets')}
                  className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSaveSet}
                  className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-sm shadow-md transition-all cursor-pointer active:scale-95"
                  id="save-vocabset-btn"
                >
                  Lưu bộ từ vựng
                </button>
              </div>
            </div>

            {/* Core Info Details */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6" id="editor-details-form">
              <div className="md:col-span-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Tên bộ từ vựng *</label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Ví dụ: Ordinal Numbers (Số thứ tự)"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-bold text-gray-800 text-lg transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Mô tả chi tiết</label>
                  <textarea
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                    placeholder="Mô tả ngắn gọn về bài học từ vựng này..."
                    className="w-full p-4 h-24 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-600 text-sm transition-all resize-none"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Khối lớp học</label>
                    <select
                      value={editorGrade}
                      onChange={(e) => setEditorGrade(e.target.value)}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                    >
                      {gradeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Môn học/Chủ đề</label>
                    <input
                      type="text"
                      value={editorSubject}
                      onChange={(e) => setEditorSubject(e.target.value)}
                      placeholder="Science, Math,..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Trạng thái chia sẻ</label>
                  <select
                    value={editorStatus}
                    onChange={(e) => setEditorStatus(e.target.value as any)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  >
                    <option value="public">Công khai: Hiển thị ở trang chủ, ai cũng có thể học</option>
                    <option value="assignment">Giao bài tập bằng link riêng: Không hiện công khai, chỉ ai có link mới làm được</option>
                    <option value="draft">Bản nháp: Chỉ lưu tạm, học sinh chưa xem được</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Từ khóa/Tags (cách nhau bằng phẩy)</label>
                  <input
                    type="text"
                    value={editorTags.join(', ')}
                    onChange={(e) => setEditorTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    placeholder="numbers, basic, ordinal"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm" id="tts-settings-card">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div className="space-y-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} className="text-indigo-600" />
                    <h3 className="font-extrabold text-gray-800 text-sm">CÃ i Ä‘áº·t phÃ¡t Ã¢m TTS</h3>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">
                    Táº¡o audio ná»n sau khi lÆ°u. Há»c sinh sáº½ phÃ¡t file Ä‘Ã£ cache, khÃ´ng gá»i TTS má»—i láº§n nghe.
                  </p>
                </div>

                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-xs">
                  <input
                    type="checkbox"
                    checked={ttsSettings.autoGenerate}
                    onChange={(e) => updateTtsSettings({ autoGenerate: e.target.checked })}
                    className="accent-indigo-600"
                  />
                  <span>Tá»± táº¡o audio khi lÆ°u</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 flex-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => updateTtsSettings({ provider: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Giá»ng Ä‘á»c</label>
                    <select
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {TTS_VOICE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">NgÃ´n ngá»¯</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({
                          lang,
                          voice: lang === 'en-GB' ? 'edge_en-GB-SoniaNeural' : 'edge_en-US-AriaNeural'
                        });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Tá»‘c Ä‘á»™</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Nghe thá»­</label>
                    <button
                      type="button"
                      onClick={handlePreviewTtsVoice}
                      disabled={isPreviewingTts}
                      className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2"
                    >
                      <Volume2 size={14} />
                      <span>{isPreviewingTts ? 'Äang táº¡o...' : 'Nghe thá»­'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Batch Paste Board */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5" id="batch-paste-panel">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-gray-50 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <ListPlus className="text-indigo-600" size={20} />
                    <h3 className="font-extrabold text-gray-800 text-base">Nhập nhanh từ vựng nhiều dòng</h3>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">
                    Mỗi dòng ở các ô bên dưới sẽ ghép thành một dòng tương ứng trong bảng từ vựng.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột từ tiếng Anh *</label>
                  <textarea
                    value={batchTerms}
                    onChange={(e) => setBatchTerms(e.target.value)}
                    placeholder="apple&#10;banana&#10;cat"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột nghĩa tiếng Việt *</label>
                  <textarea
                    value={batchMeanings}
                    onChange={(e) => setBatchMeanings(e.target.value)}
                    placeholder="quả táo&#10;quả chuối&#10;con mèo"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột phiên âm IPA</label>
                  <textarea
                    value={batchIpas}
                    onChange={(e) => setBatchIpas(e.target.value)}
                    placeholder="/ˈæpl/&#10;/bəˈnænə/&#10;/kæt/"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột từ loại</label>
                  <textarea
                    value={batchPartsOfSpeech}
                    onChange={(e) => setBatchPartsOfSpeech(e.target.value)}
                    placeholder="Noun&#10;Noun&#10;Noun"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột ví dụ tiếng Anh</label>
                  <textarea
                    value={batchExamples}
                    onChange={(e) => setBatchExamples(e.target.value)}
                    placeholder="I eat an apple after lunch.&#10;She puts a banana in her school bag.&#10;The cat sleeps near the window."
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột dịch nghĩa tiếng Việt</label>
                  <textarea
                    value={batchExampleMeanings}
                    onChange={(e) => setBatchExampleMeanings(e.target.value)}
                    placeholder="Tôi ăn một quả táo sau bữa trưa.&#10;Cô ấy bỏ một quả chuối vào cặp đi học.&#10;Con mèo ngủ gần cửa sổ."
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={handleProcessBatchAdd}
                disabled={!batchTerms.trim() || !batchMeanings.trim()}
                className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-300 text-indigo-700 font-bold rounded-xl transition-all border border-indigo-100 text-sm cursor-pointer"
                id="process-batch-btn"
              >
                Ghép dữ liệu vào bảng từ vựng
              </button>
            </div>

            {/* Main Interactive Vocabulary Grid Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="editor-items-grid">
              
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-50">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-gray-800 text-base">Danh sách từ vựng ({editorItems.length} từ)</h3>
                  <p className="text-xs text-gray-400 font-medium">Bấm "Thêm dòng" để soạn thảo hoặc tự sinh các phần còn thiếu trong bảng.</p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={handleGenerateAllBlankIpas}
                    className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-indigo-100 cursor-pointer"
                    id="auto-generate-ipa-btn"
                  >
                    <Sparkles size={14} />
                    <span>Tự sinh các phần còn thiếu</span>
                  </button>

                  <button
                    onClick={handleAddItemRow}
                    className="py-2.5 px-4 bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-700 font-bold rounded-xl text-xs border border-gray-100 transition-all flex items-center space-x-1 cursor-pointer"
                    id="add-single-row-btn"
                  >
                    <Plus size={14} />
                    <span>Thêm dòng từ mới</span>
                  </button>
                </div>
              </div>

              {/* Items Table Sheet */}
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse" id="vocab-editor-table">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 text-center w-12">STT</th>
                      <th className="p-4 w-44">Từ Tiếng Anh *</th>
                      <th className="p-4 w-44">Nghĩa Tiếng Việt *</th>
                      <th className="p-4 w-36">Phát âm IPA</th>
                      <th className="p-4 w-28">Loại từ</th>
                      <th className="p-4 min-w-[200px]">Ví dụ minh họa</th>
                      <th className="p-4 w-40">Audio TTS</th>
                      <th className="p-4 text-center w-12">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {editorItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Danh sách từ vựng trống. Hãy thêm dòng hoặc sử dụng các công cụ sinh nhanh ở trên!
                        </td>
                      </tr>
                    ) : (
                      editorItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50/30">
                          <td className="p-3 text-center text-xs font-bold text-gray-400">
                            {index + 1}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.term}
                              onChange={(e) => handleUpdateItemValue(item.id, 'term', e.target.value)}
                              placeholder="Từ tiếng Anh"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-bold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.meaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'meaning', e.target.value)}
                              placeholder="Nghĩa tiếng Việt"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-semibold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.ipa}
                                onChange={(e) => handleUpdateItemValue(item.id, 'ipa', e.target.value)}
                                placeholder="/pronunciation/"
                                className="w-full p-2.5 pr-10 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-mono text-xs transition-all"
                              />
                              <button
                                onClick={() => handleGenerateIpaForRow(item.id, item.term)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                title="Tự động bổ sung IPA, loại từ, ví dụ và dịch ví dụ"
                              >
                                <Sparkles size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.pos}
                              onChange={(e) => handleUpdateItemValue(item.id, 'pos', e.target.value)}
                              placeholder="Noun, Verb, Adjective..."
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none text-xs font-semibold transition-all"
                            />
                          </td>
                          <td className="p-3 space-y-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.example}
                                onChange={(e) => handleUpdateItemValue(item.id, 'example', e.target.value)}
                                placeholder="English example sentence..."
                                className="w-full p-2 pr-9 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => item.example.trim() && speakEnglish(item.example)}
                                disabled={!item.example.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 rounded-lg transition-all cursor-pointer"
                                title="Nghe ví dụ tiếng Anh"
                              >
                                <Volume2 size={12} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.exampleMeaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'exampleMeaning', e.target.value)}
                              placeholder="Dịch nghĩa tiếng Việt..."
                              className="w-full p-2 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs text-gray-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg border text-[10px] font-black ${
                                item.audioStatus === 'ready' || item.audioUrl
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.audioStatus === 'failed'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : item.audioStatus === 'generating' || item.audioStatus === 'queued'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
                                {item.audioStatus === 'ready' || item.audioUrl
                                  ? 'Đã có'
                                  : item.audioStatus === 'failed'
                                    ? 'Lỗi'
                                    : item.audioStatus === 'generating'
                                      ? 'Đang tạo'
                                      : item.audioStatus === 'queued'
                                        ? 'Đang chờ'
                                        : 'Chưa tạo'}
                              </span>
                              {item.audioError && (
                                <span className="text-[10px] text-rose-500 font-semibold line-clamp-2" title={item.audioError}>
                                  {item.audioError}
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePlayItemAudio(item)}
                                  disabled={!item.term.trim()}
                                  className="p-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                                  title="Nghe thử audio"
                                >
                                  <Volume2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateItemAudio(item.id, Boolean(item.audioUrl || item.audioStatus === 'failed'))}
                                  disabled={!item.term.trim() || !editingSetId}
                                  className="p-2 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                                  title={editingSetId ? 'Retry hoặc tạo lại audio' : 'Lưu bộ từ trước khi tạo audio'}
                                >
                                  <RefreshCw size={13} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItemRow(item.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: CLASSES & ENROLLMENT MANAGER */}
        {/* ==================================================================== */}
        {activeTab === 'classes' && (
          <div className="space-y-8 animate-fade-in" id="classes-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Quản lý Lớp học</h2>
                <p className="text-gray-400 text-sm">Quản lý danh sách các lớp học của cô và theo dõi các học sinh đăng ký.</p>
              </div>

              {/* Add New Class Form Box */}
              <form onSubmit={handleCreateClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tên lớp học mới..."
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="p-3 bg-white border border-gray-100 hover:border-indigo-300 rounded-2xl outline-none font-bold text-sm focus:ring-4 focus:ring-indigo-50 transition-all text-gray-800 min-w-[200px]"
                />
                <button
                  type="submit"
                  disabled={!newClassName.trim()}
                  className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all whitespace-nowrap cursor-pointer"
                  id="create-class-btn"
                >
                  Tạo lớp
                </button>
              </form>
            </div>

            {/* Grid list of classes */}
            {classes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400">
                Cô chưa tạo lớp học nào. Hãy nhập tên lớp để khởi tạo ở trên nhé!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="classes-grid">
                {classes.map((cls) => {
                  const enrolledMembers = classMembers.filter(m => m.classId === cls.id);
                  return (
                    <div key={cls.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4" id={`class-card-${cls.id}`}>
                      <div className="flex justify-between items-start pb-2 border-b border-gray-50">
                        <div>
                          <h3 className="font-extrabold text-gray-800 text-lg">{cls.name}</h3>
                          <span className="text-xs text-gray-400">Mã tham gia lớp: <strong className="font-mono text-indigo-600 font-black text-sm bg-indigo-50 px-2 py-0.5 rounded">{cls.code}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                            title="Xóa lớp học"
                          >
                            <Trash2 size={16} />
                          </button>
                          <span className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl shadow-xs shrink-0">
                            <Users size={20} />
                          </span>
                        </div>
                      </div>

                      {/* Simple list of student members inside class */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black uppercase text-gray-400 tracking-wider">Học sinh đăng ký trong lớp ({enrolledMembers.length}):</p>
                        </div>
                        
                        <div className="bg-gray-50/50 rounded-2xl p-4 max-h-[160px] overflow-y-auto space-y-2 border border-gray-100">
                          {enrolledMembers.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Chưa có học sinh nào được thêm vào lớp này.</p>
                          ) : (
                            enrolledMembers.map((member, idx) => (
                              <div key={member.id} className="flex items-center justify-between text-sm text-gray-700 font-semibold bg-white p-2 rounded-xl border border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                                  <span className="text-gray-800">{member.studentName}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteClassMember(cls.id, member.id, member.studentName)}
                                  className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                  title="Xóa học sinh khỏi lớp"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Add student inline form */}
                      <form onSubmit={(e) => handleAddClassMember(cls.id, e)} className="flex gap-2 pt-3 border-t border-white/5">
                        <input
                          type="text"
                          placeholder="Họ và tên học sinh..."
                          value={newMemberNames[cls.id] || ''}
                          onChange={(e) => setNewMemberNames(prev => ({ ...prev, [cls.id]: e.target.value }))}
                          className="flex-1 p-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={!(newMemberNames[cls.id] || '').trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:translate-y-0 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          Thêm học sinh
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: HOMEWORK ASSIGNMENTS MANAGER */}
        {/* ==================================================================== */}
        {activeTab === 'assignments' && (
          <div className="space-y-8 animate-fade-in" id="assignments-tab-content">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Column 1: New Assignment form scheduler */}
              <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5" id="assignment-creation-box">
                <div className="flex items-center space-x-2 pb-3 border-b border-gray-50">
                  <Send className="text-indigo-600" size={18} />
                  <h3 className="font-extrabold text-gray-800 text-base">Giao bài tập mới</h3>
                </div>

                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Chọn lớp học *</label>
                    <select
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chọn lớp học --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Chọn bộ từ vựng *</label>
                    <select
                      value={assignSetId}
                      onChange={(e) => setAssignSetId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chọn bộ từ --</option>
                      {vocabSets.filter(s => getSetVisibility(s) !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Thể loại game yêu cầu *</label>
                    <select
                      value={assignGameId}
                      onChange={(e) => setAssignGameId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      {GAMES_LIST.filter(g => !g.hidden).map(g => <option key={g.gameId} value={g.gameId}>{g.title} ({g.category})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Hạn nộp bài tập *</label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Tiêu đề giao bài tập (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Luyện flashcard trước buổi học"
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-semibold text-gray-600 text-sm focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer mt-4 text-sm"
                    id="schedule-assignment-btn"
                  >
                    Xác nhận giao bài
                  </button>

                </form>
              </div>

              {/* Column 2: Scheduled Assignments grid list */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="assignments-scheduled-grid">
                <div className="pb-3 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Bài tập đã giao ({assignments.length})</h3>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {assignments.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm font-medium">Cô chưa giao bài tập nào cho học sinh.</div>
                  ) : (
                    assignments.map((assign) => (
                      <div key={assign.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-3xl flex justify-between items-center" id={`assignment-strip-${assign.id}`}>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-gray-800 text-base leading-tight">{assign.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-semibold">
                            <span className="text-indigo-600">{assign.className}</span>
                            <span>•</span>
                            <span className="font-mono">{assign.vocabSetTitle}</span>
                            <span>•</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase uppercase">
                              {GAMES_LIST.find(g => g.gameId === assign.gameId)?.title || assign.gameId}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] text-gray-400 font-semibold pt-1">
                            <Calendar size={12} />
                            <span>Hạn nộp: {assign.dueDate}</span>
                          </div>
                        </div>

                        <div className="flex space-x-1 shrink-0">
                          <button
                            onClick={() => {
                              const foundSet = vocabSets.find(s => s.id === assign.vocabSetId);
                              if (foundSet) {
                                onViewAsStudent(foundSet, assign.gameId, assign.id);
                              }
                            }}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                            title="Học thử game này"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assign.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Thu hồi bài tập"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: STUDENT GOLDEN BOARD */}
        {/* ==================================================================== */}
        {activeTab === 'results' && (
          <div className="space-y-6 animate-fade-in" id="results-tab-content">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Bảng Vàng / Vinh danh học sinh chăm học</h2>
                <p className="text-gray-500 text-sm">
                  Xếp hạng dựa trên kết quả tốt nhất của từng học sinh theo mỗi bộ từ vựng và mỗi chế độ chơi, tránh cộng điểm không công bằng khi chơi lặp lại.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  value={leaderboardPeriod}
                  onChange={(e) => setLeaderboardPeriod(e.target.value as LeaderboardPeriod)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="week">Tuần này</option>
                  <option value="month">Tháng này</option>
                </select>
                <select
                  value={leaderboardCategory}
                  onChange={(e) => setLeaderboardCategory(e.target.value as LeaderboardCategory)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="gold">Bảng vàng tuần này</option>
                  <option value="diligent">Chăm chỉ nhất</option>
                  <option value="accurate">Chính xác nhất</option>
                  <option value="improved">Tiến bộ nhất</option>
                </select>
                <select
                  value={leaderboardClassId}
                  onChange={(e) => setLeaderboardClassId(e.target.value)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="">Tất cả lớp</option>
                  {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
                <select
                  value={leaderboardVocabSetId}
                  onChange={(e) => setLeaderboardVocabSetId(e.target.value)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="">Tất cả bộ từ</option>
                  {vocabSets.map(set => <option key={set.id} value={set.id}>{set.title}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaderboardRows.slice(0, 3).map((entry, index) => (
                <div key={entry.studentKey || entry.studentName} className={`rounded-3xl p-5 border shadow-sm overflow-hidden relative ${
                  index === 0 ? 'bg-amber-50 border-amber-200' :
                  index === 1 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                    <span className="text-xs font-black bg-white border border-gray-200 px-3 py-1 rounded-full text-blue-700">{entry.honorScore} điểm</span>
                  </div>
                  <h3 className="mt-4 text-lg font-black text-gray-950 truncate">{entry.studentName}</h3>
                  <p className="text-xs font-bold text-gray-600 mt-1">{entry.completedLessons} bài • {entry.averageAccuracy}% đúng • {entry.studyDays} ngày học</p>
                  <p className="mt-3 text-[11px] font-black text-blue-700 bg-white border border-blue-100 rounded-xl px-3 py-2 inline-block">{entry.badges[0]}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm overflow-hidden" id="leaderboard-sheet">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <h3 className="font-extrabold text-gray-950 text-base">{leaderboardTitleMap[leaderboardCategory]} ({leaderboardRows.length})</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Điểm = Bài x50 + Tỷ lệ đúng x3 + Ngày học x20 + Tiến bộ</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 mt-4">
                <table className="w-full text-left border-collapse" id="leaderboard-table">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-600 border-b border-gray-200">
                      <th className="p-4">STT</th>
                      <th className="p-4">Học sinh</th>
                      <th className="p-4 text-center">Bài hoàn thành</th>
                      <th className="p-4 text-center">Câu đúng</th>
                      <th className="p-4 text-center">Câu sai</th>
                      <th className="p-4 text-center">Tỷ lệ đúng</th>
                      <th className="p-4 text-center">Số ngày học</th>
                      <th className="p-4 text-center">Điểm vinh danh</th>
                      <th className="p-4">Huy hiệu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leaderboardRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-gray-500 text-sm font-medium">
                          Chưa có dữ liệu phù hợp để lập bảng vinh danh.
                        </td>
                      </tr>
                    ) : (
                      leaderboardRows.map((entry, index) => (
                        <tr key={`${entry.studentKey || entry.studentName}-${index}`} className="hover:bg-blue-50/50 text-sm font-semibold text-gray-800">
                          <td className="p-4 text-gray-500 text-xs font-bold">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-xs">
                                {entry.studentName.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <strong className="text-gray-950 font-bold">{entry.studentName}</strong>
                                {entry.className && <p className="text-[10px] text-gray-500">{entry.className}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">{entry.completedLessons}</td>
                          <td className="p-4 text-center text-emerald-700 font-bold">{entry.correctAnswers}</td>
                          <td className="p-4 text-center text-rose-700 font-bold">{entry.incorrectAnswers}</td>
                          <td className="p-4 text-center font-black text-blue-700">{entry.averageAccuracy}%</td>
                          <td className="p-4 text-center">{entry.studyDays}</td>
                          <td className="p-4 text-center">
                            <span className="px-3 py-1.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-100">{entry.honorScore}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {entry.badges.map(badge => (
                                <span key={badge} className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
                                  {badge}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 7: SUPER ADMIN USER MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'users' && user?.role === 'super_admin' && (
          <div className="space-y-6 animate-fade-in" id="users-tab-content">
            <div>
              <h2 className="text-2xl font-black text-gray-800">Quản lý Tài khoản người dùng</h2>
              <p className="text-gray-400 text-sm">Xem danh sách, tìm kiếm, phân quyền vai trò (Role) và kích hoạt/khoá (Lock) tài khoản học sinh, giáo viên.</p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, số điện thoại..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="w-full bg-gray-50 border-0 rounded-2xl py-2.5 pl-11 pr-4 text-sm font-semibold text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersRoleFilter}
                    onChange={(e) => setUsersRoleFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Tất cả vai trò</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="teacher">Giáo viên (Teacher)</option>
                    <option value="student">Học sinh (Student)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersStatusFilter}
                    onChange={(e) => setUsersStatusFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="blocked">Đã khóa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4">STT</th>
                      <th className="p-4">Tên hiển thị</th>
                      <th className="p-4">Liên hệ (Email / SĐT)</th>
                      <th className="p-4">ID tài khoản</th>
                      <th className="p-4 text-center">Vai trò</th>
                      <th className="p-4 text-center">Trạng thái</th>
                      <th className="p-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Không tìm thấy tài khoản người dùng nào khớp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u, index) => (
                        <tr key={u.id} className="hover:bg-gray-50/30 text-sm font-semibold text-gray-700">
                          <td className="p-4 text-gray-400 text-xs font-bold">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                                {(u.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <strong className="text-gray-800 font-bold">{u.name || 'Chưa đặt tên'}</strong>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-600 font-medium">{u.email || 'Không có email'}</span>
                              {u.phone && <span className="text-[10px] text-gray-400 font-bold">{u.phone}</span>}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-mono text-gray-400 max-w-[120px] truncate" title={u.id}>
                            {u.id}
                          </td>
                          <td className="p-4 text-center">
                            <select
                              value={u.role}
                              disabled={u.id === user?.id} // Cannot demote self
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              className="bg-gray-50 text-xs font-bold text-gray-700 border-0 rounded-xl py-1.5 px-3 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                            >
                              <option value="student">Học sinh (Student)</option>
                              <option value="teacher">Giáo viên (Teacher)</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              u.status === 'blocked' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {u.status === 'blocked' ? 'Đã khóa' : 'Hoạt động'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {u.id !== user?.id ? (
                              <button
                                onClick={() => handleToggleUserStatus(u.id, u.status)}
                                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                  u.status === 'blocked'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                                    : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                                }`}
                                title={u.status === 'blocked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                              >
                                {u.status === 'blocked' ? <Unlock size={14} /> : <Lock size={14} />}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Bản thân</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8: AUDIT LOGS VIEW */}
        {/* ==================================================================== */}
        {activeTab === 'audit-logs' && user?.role === 'super_admin' && (
          <div className="space-y-6 animate-fade-in" id="audit-logs-tab-content">
            <div>
              <h2 className="text-2xl font-black text-gray-800">Nhật ký hệ thống (Audit Logs)</h2>
              <p className="text-gray-400 text-sm">Ghi chép các sự kiện quan trọng trong hệ thống: đăng ký mới, cập nhật vai trò, khóa/mở khóa tài khoản.</p>
            </div>

            {/* Logs Timeline Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 w-16">STT</th>
                      <th className="p-4 w-48">Thời gian</th>
                      <th className="p-4 w-40">Hành động</th>
                      <th className="p-4 w-52">Người thực hiện</th>
                      <th className="p-4">Chi tiết hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Chưa có nhật ký hoạt động nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, index) => {
                        const dateFormatted = log.timestamp
                          ? new Date(log.timestamp).toLocaleString('vi-VN', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Unknown';
                        
                        let actionBadgeColor = 'bg-gray-50 text-gray-600';
                        if (log.action === 'LOCK_USER') actionBadgeColor = 'bg-rose-50 text-rose-700';
                        if (log.action === 'UNLOCK_USER') actionBadgeColor = 'bg-emerald-50 text-emerald-700';
                        if (log.action === 'UPDATE_USER_ROLE') actionBadgeColor = 'bg-amber-50 text-amber-700';
                        if (log.action === 'REGISTER_USER') actionBadgeColor = 'bg-indigo-50 text-indigo-700';

                        return (
                          <tr key={log.id} className="hover:bg-gray-50/30 text-xs font-semibold text-gray-700">
                            <td className="p-4 text-gray-400 font-bold">{index + 1}</td>
                            <td className="p-4 text-gray-500 font-normal">{dateFormatted}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${actionBadgeColor}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-gray-800 font-bold">{log.userName || 'Hệ thống'}</span>
                                <span className="text-[10px] text-gray-400">{log.userEmail || ''}</span>
                              </div>
                            </td>
                            <td className="p-4 text-gray-600 font-normal font-mono max-w-[300px] truncate" title={log.details}>
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}


