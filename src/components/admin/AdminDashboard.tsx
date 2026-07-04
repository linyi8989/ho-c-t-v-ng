import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Copy, Search, Filter, BookOpen, Layers, Users, 
  Calendar, Award, Sparkles, Check, Play, RefreshCw, Send, AlertCircle, ListPlus, Volume2,
  Shield, FileText, Lock, Unlock, Star
} from 'lucide-react';
import { VocabSet, VocabItem, Class, ClassMember, Assignment, GameSession } from '../../types';
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

const DEFAULT_GRADE_OPTIONS = ['Lá»›p 3', 'Lá»›p 6', 'Lá»›p 10'];

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

  // Class Roster dynamic input states
  const [newMemberNames, setNewMemberNames] = useState<Record<string, string>>({});

  // Active Vocab Set Editor State
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorSubject, setEditorSubject] = useState('English');
  const [editorGrade, setEditorGrade] = useState('Lá»›p 3');
  const [editorStatus, setEditorStatus] = useState<VocabVisibility>('public');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorItems, setEditorItems] = useState<VocabItem[]>([]);

  // Quick Batch Add States
  const [batchTerms, setBatchTerms] = useState('');
  const [batchMeanings, setBatchMeanings] = useState('');
  const [batchIpas, setBatchIpas] = useState('');

  // AI Generation States
  const [aiTopic, setAiTopic] = useState('');
  const [aiGrade, setAiGrade] = useState('Lá»›p 3');
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
    setEditorGrade('Lá»›p 3');
    setEditorStatus('public');
    setEditorTags(['basic']);
    setEditorItems([]);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
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
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
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

  const handleDeleteItemRow = (id: string) => {
    setEditorItems(prev => prev.filter(item => item.id !== id));
  };

  // Batch import text converter (GhÃ©p nhanh nhiá»u dÃ²ng)
  const handleProcessBatchAdd = () => {
    const terms = batchTerms.split('\n').map(t => t.trim()).filter(Boolean);
    const meanings = batchMeanings.split('\n').map(m => m.trim()).filter(Boolean);
    const ipas = batchIpas.split('\n').map(i => i.trim());

    if (terms.length === 0 || meanings.length === 0) {
      showNotification("HÃ£y nháº­p dá»¯ liá»‡u tá»« vÃ  nghÄ©a trÆ°á»›c khi ghÃ©p.", "error");
      return;
    }

    const linesCount = Math.max(terms.length, meanings.length);
    const importedItems: VocabItem[] = [];

    for (let i = 0; i < linesCount; i++) {
      importedItems.push({
        id: `item-${Date.now()}-${i}`,
        term: terms[i] || '',
        meaning: meanings[i] || meanings[meanings.length - 1] || '',
        ipa: ipas[i] || '',
        pos: '',
        example: '',
        exampleMeaning: '',
        displayOrder: editorItems.length + i + 1
      });
    }

    setEditorItems([...editorItems, ...importedItems]);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    showNotification(`ÄÃ£ ghÃ©p thÃ nh cÃ´ng ${importedItems.length} tá»« vá»±ng vÃ o báº£ng.`);
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
      showNotification("Táº¥t cáº£ cÃ¡c tá»« trong báº£ng Ä‘á»u Ä‘Ã£ Ä‘á»§ IPA, loáº¡i tá»«, vÃ­ dá»¥ vÃ  dá»‹ch nghÄ©a vÃ­ dá»¥.");
      return;
    }

    showNotification("Äang tá»± sinh cÃ¡c pháº§n cÃ²n thiáº¿u báº±ng AI...");
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

  // AI Vocab set generator (TÃ­ch há»£p thá»±c táº¿ vá»›i Gemini)
  const handleGenerateSetByAI = async () => {
    if (!aiTopic.trim()) {
      showNotification("HÃ£y nháº­p chá»§ Ä‘á» Ä‘á»ƒ AI táº¡o tá»« vá»±ng.", "error");
      return;
    }

    setIsAiGenerating(true);
    showNotification("Há»‡ thá»‘ng Gemini Ä‘ang táº¡o bá»™ tá»« vá»±ng thÃ´ng minh cho em...");

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
        showNotification(data.error || "KhÃ´ng thá»ƒ táº¡o tá»« vá»±ng báº±ng AI. HÃ£y thá»­ láº¡i.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("Lá»—i káº¿t ná»‘i AI: " + err.message, "error");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveSet = () => {
    if (!editorTitle.trim()) {
      showNotification("HÃ£y Ä‘iá»n tÃªn bá»™ tá»« vá»±ng.", "error");
      return;
    }

    if (editorItems.length === 0) {
      showNotification("Danh sÃ¡ch tá»« vá»±ng trá»‘ng. HÃ£y thÃªm Ã­t nháº¥t má»™t tá»«.", "error");
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
      creatorName: user?.name || "CÃ´ Tháº£o English",
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
      showNotification("LÆ°u bá»™ tá»« vá»±ng thÃ nh cÃ´ng!");
      const savedVisibility = getSetVisibility(data);
      const assignmentUrl = getAssignmentLink(data);
      if (savedVisibility === 'assignment' && assignmentUrl) {
        setShareLinkNotice({ title: data.title, url: assignmentUrl });
      } else {
        setShareLinkNotice(null);
      }
      refreshData();
      setActiveTab('vocab-sets');
    })
    .catch(err => {
      console.error(err);
      showNotification("KhÃ´ng thá»ƒ lÆ°u bá»™ tá»« vá»±ng.", "error");
    });
  };

  // --- CRUD VOCAB LIST ACTIONS ---
  const handleCloneSet = (id: string) => {
    authFetch(`/api/vocab-sets/${id}/clone`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        showNotification(`ÄÃ£ sao chÃ©p bá»™ tá»« vá»±ng thÃ nh cÃ´ng.`);
        refreshData();
      })
      .catch(err => console.error(err));
  };

  const handleDeleteSet = (id: string) => {
    if (!window.confirm("Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a bá»™ tá»« vá»±ng nÃ y? HÃ nh Ä‘á»™ng nÃ y cÅ©ng sáº½ gá»¡ bá» táº¥t cáº£ bÃ i giao tÆ°Æ¡ng á»©ng.")) return;
    
    authFetch(`/api/vocab-sets/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        showNotification("ÄÃ£ xÃ³a bá»™ tá»« vá»±ng thÃ nh cÃ´ng.");
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
      showNotification(`Táº¡o lá»›p "${data.name}" thÃ nh cÃ´ng vá»›i mÃ£ má»i: ${data.code}`);
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
      showNotification(`ÄÃ£ thÃªm há»c sinh "${data.studentName}" vÃ o lá»›p thÃ nh cÃ´ng.`);
      setNewMemberNames(prev => ({ ...prev, [classId]: '' }));
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleDeleteClassMember = (classId: string, memberId: string, studentName: string) => {
    if (!window.confirm(`Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a há»c sinh "${studentName}" khá»i lá»›p?`)) return;

    authFetch(`/api/classes/${classId}/members/${memberId}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showNotification(`ÄÃ£ xÃ³a há»c sinh khá»i lá»›p.`);
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleDeleteClass = (id: string, className: string) => {
    if (!window.confirm(`Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a lá»›p "${className}"? HÃ nh Ä‘á»™ng nÃ y sáº½ gá»¡ bá» táº¥t cáº£ há»c sinh vÃ  bÃ i táº­p Ä‘Ã£ giao.`)) return;

    authFetch(`/api/classes/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showNotification(`ÄÃ£ xÃ³a lá»›p "${className}" thÃ nh cÃ´ng.`);
      refreshData();
    })
    .catch(err => console.error(err));
  };

  // --- ASSIGNMENTS SCHEDULER ---
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSetId || !assignDueDate) {
      showNotification("Vui lÃ²ng Ä‘iá»n Ä‘á»§ thÃ´ng tin giao bÃ i.", "error");
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
      title: assignTitle.trim() || `Há»c tá»« vá»±ng: ${selectedSet.title}`
    };

    authFetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      showNotification("Giao bÃ i táº­p cho há»c sinh lá»›p thÃ nh cÃ´ng!");
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
        showNotification("ÄÃ£ thu há»“i bÃ i giao thÃ nh cÃ´ng.");
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

  const dashboardGoldRows = React.useMemo(() => {
    return getLeaderboardByCategory(results, assignments, { period: 'week' }, 'gold').slice(0, 5);
  }, [results, assignments]);

  const leaderboardTitleMap: Record<LeaderboardCategory, string> = {
    gold: 'Báº£ng vÃ ng tuáº§n nÃ y',
    diligent: 'ChÄƒm chá»‰ nháº¥t',
    accurate: 'ChÃ­nh xÃ¡c nháº¥t',
    improved: 'Tiáº¿n bá»™ nháº¥t'
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
        showNotification("Cáº­p nháº­t vai trÃ² ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng!");
        refreshData();
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("KhÃ´ng thá»ƒ cáº­p nháº­t vai trÃ² ngÆ°á»i dÃ¹ng.", "error");
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
        showNotification(newStatus === 'blocked' ? "ÄÃ£ khÃ³a tÃ i khoáº£n thÃ nh cÃ´ng!" : "ÄÃ£ má»Ÿ khÃ³a tÃ i khoáº£n thÃ nh cÃ´ng!");
        refreshData();
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i tÃ i khoáº£n.", "error");
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
            <p className="text-[10px] font-black uppercase text-indigo-500">Link giao bÃ i riÃªng</p>
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
                showNotification("ÄÃ£ copy link giao bÃ i.");
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
            ÄÃ³ng
          </button>
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
            <h1 className="font-black text-gray-800 tracking-tight text-base leading-snug">CÃ´ Diá»‡u Tiáº¿ng Anh</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {user?.role === 'super_admin' ? 'Há»‡ thá»‘ng Admin' : 'Dashboard GiÃ¡o ViÃªn'}
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
            <span>Tá»•ng quan</span>
          </button>
          
          <button
            onClick={() => setActiveTab('vocab-sets')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'vocab-sets' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-sets"
          >
            <BookOpen size={18} />
            <span>Kho tá»« vá»±ng</span>
          </button>

          <button
            onClick={handleOpenNewEditor}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'editor' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-editor"
          >
            <Plus size={18} />
            <span>Soáº¡n tá»« vá»±ng má»›i</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'classes' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-classes"
          >
            <Users size={18} />
            <span>Quáº£n lÃ½ Lá»›p há»c</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'results' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-results"
          >
            <Award size={18} />
            <span>Báº£ng vÃ ng há»c sinh</span>
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
                <span>Quáº£n lÃ½ TÃ i khoáº£n</span>
              </button>

              <button
                onClick={() => setActiveTab('audit-logs')}
                className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'audit-logs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
                id="tab-audit-logs"
              >
                <FileText size={18} className="text-amber-500" />
                <span>Nháº­t kÃ½ há»‡ thá»‘ng</span>
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
              <p className="text-xs font-bold text-gray-800 truncate">{user?.name || 'Há»‡ thá»‘ng Admin'}</p>
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
                <h2 className="text-2xl font-black text-gray-800">Xin chÃ o, CÃ´ Tháº£o!</h2>
                <p className="text-gray-400 text-sm font-medium">HÃ´m nay hÃ£y cÃ¹ng cÃ¡c há»c sinh há»c tháº­t nhiá»u tá»« vá»±ng má»›i nhÃ©.</p>
              </div>
              <button
                onClick={handleOpenNewEditor}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center space-x-2 cursor-pointer active:scale-95 text-sm"
              >
                <Plus size={16} />
                <span>Soáº¡n bá»™ tá»« má»›i</span>
              </button>
            </div>

            {/* Quick Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                  <BookOpen size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">Bá»˜ Tá»ª Vá»°NG</span>
                  <span className="text-2xl font-black text-gray-800">{vocabSets.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <Users size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">Lá»šP Há»ŒC</span>
                  <span className="text-2xl font-black text-gray-800">{classes.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <Star size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">Há»ŒC SINH VINH DANH</span>
                  <span className="text-2xl font-black text-gray-800">{dashboardGoldRows.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                  <Award size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LÆ¯á»¢T HOÃ€N THÃ€NH</span>
                  <span className="text-2xl font-black text-gray-800">{results.length}</span>
                </div>
              </div>
            </div>

            {/* Recent activity grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Recent Student Results */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Hoáº¡t Ä‘á»™ng luyá»‡n táº­p gáº§n Ä‘Ã¢y</h3>
                  <button onClick={() => setActiveTab('results')} className="text-xs font-bold text-indigo-600 hover:underline">Xem táº¥t cáº£</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {results.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">ChÆ°a cÃ³ há»c sinh nÃ o hoÃ n thÃ nh trÃ² chÆ¡i.</div>
                  ) : (
                    results.map((res) => (
                      <div key={res.id} className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl flex justify-between items-center">
                        <div className="space-y-0.5">
                          <strong className="text-sm font-bold text-gray-800">{res.studentName}</strong>
                          <p className="text-xs text-gray-400">ChÆ¡i {GAMES_LIST.find(g => g.gameId === res.gameId)?.title || res.gameId}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{res.vocabSetTitle}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2.5 py-1 text-xs font-black rounded-full ${
                            res.score >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {res.score} Ä‘iá»ƒm
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-1">ÄÃºng: {res.correctAnswers}/{res.totalQuestions}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Golden Board Quick Summary */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Báº£ng vÃ ng tuáº§n nÃ y</h3>
                  <button onClick={() => setActiveTab('results')} className="text-xs font-bold text-indigo-600 hover:underline">Xem báº£ng vÃ ng</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {dashboardGoldRows.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">ChÆ°a cÃ³ dá»¯ liá»‡u Ä‘á»ƒ vinh danh há»c sinh.</div>
                  ) : (
                    dashboardGoldRows.map((entry, index) => (
                      <div key={`${entry.studentName}-${index}`} className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl flex justify-between items-center">
                        <div className="space-y-0.5">
                          <strong className="text-sm font-bold text-gray-800">{index === 0 ? 'ðŸ¥‡ ' : index === 1 ? 'ðŸ¥ˆ ' : index === 2 ? 'ðŸ¥‰ ' : ''}{entry.studentName}</strong>
                          <p className="text-xs text-indigo-600 font-semibold">{entry.completedLessons} bÃ i hoÃ n thÃ nh â€¢ {entry.averageAccuracy}% Ä‘Ãºng</p>
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
                <h2 className="text-2xl font-black text-gray-800">Kho tá»« vá»±ng cá»§a tÃ´i</h2>
                <p className="text-gray-400 text-sm">NÆ¡i lÆ°u trá»¯ vÃ  soáº¡n tháº£o cÃ¡c bá»™ tháº» tá»« vá»±ng Ä‘á»ƒ giao cho há»c sinh.</p>
              </div>
              <button
                onClick={handleOpenNewEditor}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Plus size={18} />
                <span>Soáº¡n bá»™ tá»« má»›i</span>
              </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="TÃ¬m kiáº¿m bá»™ tá»« vá»±ng theo tÃªn, mÃ´ táº£, mÃ´n há»c..."
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
                  <option value="">Táº¥t cáº£ Lá»›p há»c</option>
                  {gradeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Táº¥t cáº£ Tráº¡ng thÃ¡i</option>
                  <option value="public">CÃ´ng khai</option>
                  <option value="draft">Báº£n nhÃ¡p</option>
                  <option value="assignment">Giao bÃ i táº­p báº±ng link riÃªng</option>
                </select>
              </div>
            </div>

            {/* Grid list of sets */}
            {filteredSets.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-medium">
                KhÃ´ng tÃ¬m tháº¥y bá»™ tá»« vá»±ng nÃ o khá»›p vá»›i Ä‘iá»u kiá»‡n tÃ¬m kiáº¿m.
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
                          {visibility === 'public' ? 'CÃ”NG KHAI' : visibility === 'draft' ? 'Báº¢N NHÃP' : 'LINK RIÃŠNG'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-extrabold text-gray-800 text-lg leading-tight truncate-2-lines">{set.title}</h3>
                        <p className="text-xs text-gray-400 font-medium">Chá»§ Ä‘á»: {set.subject}</p>
                        <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mt-1">{set.description}</p>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {set.tags.map((t, idx) => (
                          <span key={idx} className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">#{t}</span>
                        ))}
                      </div>
                      {visibility === 'assignment' && assignmentLink && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 space-y-2">
                          <p className="text-[10px] font-black uppercase text-indigo-500">Link giao bÃ i</p>
                          <div className="flex gap-2">
                            <input
                              value={assignmentLink}
                              readOnly
                              className="min-w-0 flex-1 bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[11px] font-semibold text-gray-600"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(assignmentLink);
                                showNotification("ÄÃ£ copy link giao bÃ i.");
                              }}
                              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer"
                              title="Copy link giao bÃ i"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-semibold">{set.items.length} tá»« vá»±ng</span>
                      
                      <div className="flex space-x-1">
                        <button
                          onClick={() => onViewAsStudent(set)}
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                          title="Há»c táº­p"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEditEditor(set)}
                          className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all cursor-pointer"
                          title="Sá»­a"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleCloneSet(set.id)}
                          className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all cursor-pointer"
                          title="NhÃ¢n báº£n"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="XÃ³a"
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
                  {editingSetId ? "Chá»‰nh sá»­a bá»™ tá»« vá»±ng" : "Soáº¡n tháº£o bá»™ tá»« vá»±ng má»›i"}
                </h2>
                <p className="text-gray-400 text-sm">Äiá»n Ä‘áº§y Ä‘á»§ thÃ´ng tin bÃªn dÆ°á»›i hoáº·c dÃ¹ng AI sinh nhanh tá»« vá»±ng.</p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('vocab-sets')}
                  className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  Há»§y bá»
                </button>
                <button
                  onClick={handleSaveSet}
                  className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-sm shadow-md transition-all cursor-pointer active:scale-95"
                  id="save-vocabset-btn"
                >
                  LÆ°u bá»™ tá»« vá»±ng
                </button>
              </div>
            </div>

            {/* Core Info Details */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6" id="editor-details-form">
              <div className="md:col-span-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">TÃªn bá»™ tá»« vá»±ng *</label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="VÃ­ dá»¥: Ordinal Numbers (Sá»‘ thá»© tá»±)"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-bold text-gray-800 text-lg transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">MÃ´ táº£ chi tiáº¿t</label>
                  <textarea
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                    placeholder="MÃ´ táº£ ngáº¯n gá»n vá» bÃ i há»c tá»« vá»±ng nÃ y..."
                    className="w-full p-4 h-24 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-600 text-sm transition-all resize-none"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Khá»‘i lá»›p há»c</label>
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
                    <label className="text-xs font-bold uppercase text-gray-400">MÃ´n há»c/Chá»§ Ä‘á»</label>
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
                  <label className="text-xs font-bold uppercase text-gray-400">Tráº¡ng thÃ¡i chia sáº»</label>
                  <select
                    value={editorStatus}
                    onChange={(e) => setEditorStatus(e.target.value as any)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  >
                    <option value="public">CÃ´ng khai: Hiá»ƒn thá»‹ á»Ÿ trang chá»§, ai cÅ©ng cÃ³ thá»ƒ há»c</option>
                    <option value="assignment">Giao bÃ i táº­p báº±ng link riÃªng: KhÃ´ng hiá»‡n cÃ´ng khai, chá»‰ ai cÃ³ link má»›i lÃ m Ä‘Æ°á»£c</option>
                    <option value="draft">Báº£n nhÃ¡p: Chá»‰ lÆ°u táº¡m, há»c sinh chÆ°a xem Ä‘Æ°á»£c</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Tá»« khÃ³a/Tags (cÃ¡ch nhau báº±ng pháº©y)</label>
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

            {/* Smart Creation Helpers (AI Creator + Quick Batch Paste Board) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Box A: Gemini AI Set Generator */}
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden" id="ai-creator-panel">
                {/* Sparkles design */}
                <div className="absolute right-0 bottom-0 w-36 h-36 bg-white/5 rounded-full blur-3xl -mr-10 -mb-10" />
                
                <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                  <Sparkles className="text-amber-300 animate-pulse" size={20} />
                  <h3 className="font-extrabold text-base">Táº¡o bá»™ tá»« vá»±ng tháº§n tá»‘c báº±ng Gemini AI</h3>
                </div>

                <p className="text-xs text-white/80 leading-relaxed">
                  Nháº­p tÃªn chá»§ Ä‘á» (vÃ­ dá»¥: "School items", "Family members", "Weather") vÃ  chá»n sá»‘ lÆ°á»£ng tá»«, trÃ­ tuá»‡ nhÃ¢n táº¡o Gemini sáº½ tá»± Ä‘á»™ng sinh trá»n bá»™ tá»«, nghÄ©a, vÃ­ dá»¥ tiáº¿ng Anh kÃ¨m dá»‹ch tiáº¿ng Viá»‡t hoÃ n chá»‰nh!
                </p>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-white/60">TÃªn chá»§ Ä‘á» tiáº¿ng Anh hoáº·c tiáº¿ng Viá»‡t</label>
                    <input
                      type="text"
                      placeholder="VÃ­ dá»¥: Household chores (Viá»‡c nhÃ )"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      className="w-full p-3.5 bg-white/10 focus:bg-white focus:text-gray-800 rounded-2xl border border-white/10 focus:border-indigo-400 outline-none font-bold text-sm text-white placeholder-white/40 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-white/60 font-semibold">Äá»™ tuá»•i/Lá»›p há»c</label>
                      <select
                        value={aiGrade}
                        onChange={(e) => setAiGrade(e.target.value)}
                        className="w-full p-3.5 bg-white/10 rounded-2xl border border-white/10 outline-none text-white font-bold text-sm"
                        style={{ colorScheme: 'dark' }}
                      >
                        {gradeOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-white/60 font-semibold">Sá»‘ lÆ°á»£ng tá»«</label>
                      <select
                        value={aiCount}
                        onChange={(e) => setAiCount(Number(e.target.value))}
                        className="w-full p-3.5 bg-white/10 rounded-2xl border border-white/10 outline-none text-white font-bold text-sm"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="5">5 tá»« vá»±ng</option>
                        <option value="8">8 tá»« vá»±ng</option>
                        <option value="12">12 tá»« vá»±ng</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateSetByAI}
                    disabled={isAiGenerating || !aiTopic.trim()}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:bg-white/20 disabled:text-white/40 font-black text-indigo-900 rounded-2xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                    id="ai-generate-vocab-btn"
                  >
                    {isAiGenerating ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        <span>Äang táº¡o... (máº¥t khoáº£ng vÃ i giÃ¢y)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Sinh tá»« vá»±ng báº±ng AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Box B: Double-Column Batch Import Board */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between" id="batch-paste-panel">
                <div className="flex items-center space-x-2 border-b border-gray-50 pb-3">
                  <ListPlus className="text-indigo-600" size={20} />
                  <h3 className="font-extrabold text-gray-800 text-base">Nháº­p nhanh tá»« vá»±ng nhiá»u dÃ²ng</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Cá»™t Tá»« Tiáº¿ng Anh</label>
                    <textarea
                      value={batchTerms}
                      onChange={(e) => setBatchTerms(e.target.value)}
                      placeholder="apple&#10;banana&#10;cat"
                      className="w-full h-24 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Cá»™t NghÄ©a Tiáº¿ng Viá»‡t</label>
                    <textarea
                      value={batchMeanings}
                      onChange={(e) => setBatchMeanings(e.target.value)}
                      placeholder="quáº£ tÃ¡o&#10;quáº£ chuá»‘i&#10;con mÃ¨o"
                      className="w-full h-24 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cá»™t PhiÃªn Ã¢m IPA (CÃ³ thá»ƒ Ä‘á»ƒ trá»‘ng)</label>
                  <input
                    type="text"
                    value={batchIpas}
                    onChange={(e) => setBatchIpas(e.target.value)}
                    placeholder="/ËˆÃ¦pl/, /ËˆsekÉ™nd/, ..."
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none text-xs"
                  />
                </div>

                <button
                  onClick={handleProcessBatchAdd}
                  disabled={!batchTerms.trim() || !batchMeanings.trim()}
                  className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-300 text-indigo-700 font-bold rounded-xl transition-all border border-indigo-100 text-sm mt-3 cursor-pointer"
                  id="process-batch-btn"
                >
                  GhÃ©p dá»¯ liá»‡u vÃ o báº£ng tá»« vá»±ng
                </button>
              </div>

            </div>

            {/* Main Interactive Vocabulary Grid Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="editor-items-grid">
              
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-50">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-gray-800 text-base">Danh sÃ¡ch tá»« vá»±ng ({editorItems.length} tá»«)</h3>
                  <p className="text-xs text-gray-400 font-medium">Báº¥m "ThÃªm dÃ²ng" Ä‘á»ƒ soáº¡n tháº£o hoáº·c tá»± sinh cÃ¡c pháº§n cÃ²n thiáº¿u trong báº£ng.</p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={handleGenerateAllBlankIpas}
                    className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-indigo-100 cursor-pointer"
                    id="auto-generate-ipa-btn"
                  >
                    <Sparkles size={14} />
                    <span>Tá»± sinh cÃ¡c pháº§n cÃ²n thiáº¿u</span>
                  </button>

                  <button
                    onClick={handleAddItemRow}
                    className="py-2.5 px-4 bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-700 font-bold rounded-xl text-xs border border-gray-100 transition-all flex items-center space-x-1 cursor-pointer"
                    id="add-single-row-btn"
                  >
                    <Plus size={14} />
                    <span>ThÃªm dÃ²ng tá»« má»›i</span>
                  </button>
                </div>
              </div>

              {/* Items Table Sheet */}
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse" id="vocab-editor-table">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 text-center w-12">STT</th>
                      <th className="p-4 w-44">Tá»« Tiáº¿ng Anh *</th>
                      <th className="p-4 w-44">NghÄ©a Tiáº¿ng Viá»‡t *</th>
                      <th className="p-4 w-36">PhÃ¡t Ã¢m IPA</th>
                      <th className="p-4 w-28">Loáº¡i tá»«</th>
                      <th className="p-4 min-w-[200px]">VÃ­ dá»¥ minh há»a</th>
                      <th className="p-4 text-center w-12">Thao tÃ¡c</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {editorItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Danh sÃ¡ch tá»« vá»±ng trá»‘ng. HÃ£y thÃªm dÃ²ng hoáº·c sá»­ dá»¥ng cÃ¡c cÃ´ng cá»¥ sinh nhanh á»Ÿ trÃªn!
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
                              placeholder="Tá»« tiáº¿ng Anh"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-bold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.meaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'meaning', e.target.value)}
                              placeholder="NghÄ©a tiáº¿ng Viá»‡t"
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
                                title="Tá»± Ä‘á»™ng bá»• sung IPA, loáº¡i tá»«, vÃ­ dá»¥ vÃ  dá»‹ch vÃ­ dá»¥"
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
                                title="Nghe vÃ­ dá»¥ tiáº¿ng Anh"
                              >
                                <Volume2 size={12} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.exampleMeaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'exampleMeaning', e.target.value)}
                              placeholder="Dá»‹ch nghÄ©a tiáº¿ng Viá»‡t..."
                              className="w-full p-2 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs text-gray-500"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItemRow(item.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="XÃ³a dÃ²ng"
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
                <h2 className="text-2xl font-black text-gray-800">Quáº£n lÃ½ Lá»›p há»c</h2>
                <p className="text-gray-400 text-sm">Quáº£n lÃ½ danh sÃ¡ch cÃ¡c lá»›p há»c cá»§a cÃ´ vÃ  theo dÃµi cÃ¡c há»c sinh Ä‘Äƒng kÃ½.</p>
              </div>

              {/* Add New Class Form Box */}
              <form onSubmit={handleCreateClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="TÃªn lá»›p há»c má»›i..."
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
                  Táº¡o lá»›p
                </button>
              </form>
            </div>

            {/* Grid list of classes */}
            {classes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400">
                CÃ´ chÆ°a táº¡o lá»›p há»c nÃ o. HÃ£y nháº­p tÃªn lá»›p Ä‘á»ƒ khá»Ÿi táº¡o á»Ÿ trÃªn nhÃ©!
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
                          <span className="text-xs text-gray-400">MÃ£ tham gia lá»›p: <strong className="font-mono text-indigo-600 font-black text-sm bg-indigo-50 px-2 py-0.5 rounded">{cls.code}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                            title="XÃ³a lá»›p há»c"
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
                          <p className="text-xs font-black uppercase text-gray-400 tracking-wider">Há»c sinh Ä‘Äƒng kÃ½ trong lá»›p ({enrolledMembers.length}):</p>
                        </div>
                        
                        <div className="bg-gray-50/50 rounded-2xl p-4 max-h-[160px] overflow-y-auto space-y-2 border border-gray-100">
                          {enrolledMembers.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">ChÆ°a cÃ³ há»c sinh nÃ o Ä‘Æ°á»£c thÃªm vÃ o lá»›p nÃ y.</p>
                          ) : (
                            enrolledMembers.map((member, idx) => (
                              <div key={member.id} className="flex items-center justify-between text-sm text-gray-700 font-semibold bg-white p-2 rounded-xl border border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                                  <span className="text-gray-100">{member.studentName}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteClassMember(cls.id, member.id, member.studentName)}
                                  className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                  title="XÃ³a há»c sinh khá»i lá»›p"
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
                          placeholder="Há» vÃ  tÃªn há»c sinh..."
                          value={newMemberNames[cls.id] || ''}
                          onChange={(e) => setNewMemberNames(prev => ({ ...prev, [cls.id]: e.target.value }))}
                          className="flex-1 p-2 bg-slate-950/45 border border-white/10 rounded-xl outline-none text-xs font-bold text-gray-100 placeholder-gray-500 focus:border-indigo-500/50"
                        />
                        <button
                          type="submit"
                          disabled={!(newMemberNames[cls.id] || '').trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:translate-y-0 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          ThÃªm há»c sinh
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
                  <h3 className="font-extrabold text-gray-800 text-base">Giao bÃ i táº­p má»›i</h3>
                </div>

                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Chá»n lá»›p há»c *</label>
                    <select
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chá»n lá»›p há»c --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Chá»n bá»™ tá»« vá»±ng *</label>
                    <select
                      value={assignSetId}
                      onChange={(e) => setAssignSetId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chá»n bá»™ tá»« --</option>
                      {vocabSets.filter(s => getSetVisibility(s) !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Thá»ƒ loáº¡i game yÃªu cáº§u *</label>
                    <select
                      value={assignGameId}
                      onChange={(e) => setAssignGameId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      {GAMES_LIST.map(g => <option key={g.gameId} value={g.gameId}>{g.title} ({g.category})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Háº¡n ná»™p bÃ i táº­p *</label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">TiÃªu Ä‘á» giao bÃ i táº­p (TÃ¹y chá»n)</label>
                    <input
                      type="text"
                      placeholder="VÃ­ dá»¥: Luyá»‡n flashcard trÆ°á»›c buá»•i há»c"
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
                    XÃ¡c nháº­n giao bÃ i
                  </button>

                </form>
              </div>

              {/* Column 2: Scheduled Assignments grid list */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="assignments-scheduled-grid">
                <div className="pb-3 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">BÃ i táº­p Ä‘Ã£ giao ({assignments.length})</h3>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {assignments.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm font-medium">CÃ´ chÆ°a giao bÃ i táº­p nÃ o cho há»c sinh.</div>
                  ) : (
                    assignments.map((assign) => (
                      <div key={assign.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-3xl flex justify-between items-center" id={`assignment-strip-${assign.id}`}>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-gray-800 text-base leading-tight">{assign.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-semibold">
                            <span className="text-indigo-600">{assign.className}</span>
                            <span>â€¢</span>
                            <span className="font-mono">{assign.vocabSetTitle}</span>
                            <span>â€¢</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase uppercase">
                              {GAMES_LIST.find(g => g.gameId === assign.gameId)?.title || assign.gameId}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] text-gray-400 font-semibold pt-1">
                            <Calendar size={12} />
                            <span>Háº¡n ná»™p: {assign.dueDate}</span>
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
                            title="Há»c thá»­ game nÃ y"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assign.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Thu há»“i bÃ i táº­p"
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
                <h2 className="text-2xl font-black text-gray-100">Báº£ng VÃ ng / Vinh danh há»c sinh chÄƒm há»c</h2>
                <p className="text-slate-400 text-sm">
                  Xáº¿p háº¡ng dá»±a trÃªn káº¿t quáº£ tá»‘t nháº¥t cá»§a tá»«ng há»c sinh theo má»—i bá»™ tá»« vá»±ng vÃ  má»—i cháº¿ Ä‘á»™ chÆ¡i, trÃ¡nh cá»™ng Ä‘iá»ƒm khÃ´ng cÃ´ng báº±ng khi chÆ¡i láº·p láº¡i.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  value={leaderboardPeriod}
                  onChange={(e) => setLeaderboardPeriod(e.target.value as LeaderboardPeriod)}
                  className="p-3 bg-slate-900 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-100 focus:border-indigo-400"
                >
                  <option value="week">Tuáº§n nÃ y</option>
                  <option value="month">ThÃ¡ng nÃ y</option>
                </select>
                <select
                  value={leaderboardCategory}
                  onChange={(e) => setLeaderboardCategory(e.target.value as LeaderboardCategory)}
                  className="p-3 bg-slate-900 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-100 focus:border-indigo-400"
                >
                  <option value="gold">Báº£ng vÃ ng tuáº§n nÃ y</option>
                  <option value="diligent">ChÄƒm chá»‰ nháº¥t</option>
                  <option value="accurate">ChÃ­nh xÃ¡c nháº¥t</option>
                  <option value="improved">Tiáº¿n bá»™ nháº¥t</option>
                </select>
                <select
                  value={leaderboardClassId}
                  onChange={(e) => setLeaderboardClassId(e.target.value)}
                  className="p-3 bg-slate-900 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-100 focus:border-indigo-400"
                >
                  <option value="">Táº¥t cáº£ lá»›p</option>
                  {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
                <select
                  value={leaderboardVocabSetId}
                  onChange={(e) => setLeaderboardVocabSetId(e.target.value)}
                  className="p-3 bg-slate-900 border border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-100 focus:border-indigo-400"
                >
                  <option value="">Táº¥t cáº£ bá»™ tá»«</option>
                  {vocabSets.map(set => <option key={set.id} value={set.id}>{set.title}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaderboardRows.slice(0, 3).map((entry, index) => (
                <div key={entry.studentKey || entry.studentName} className={`rounded-3xl p-5 border shadow-lg overflow-hidden relative ${
                  index === 0 ? 'bg-gradient-to-br from-amber-950 via-slate-950 to-yellow-900 border-amber-400/30 shadow-amber-950/30' :
                  index === 1 ? 'bg-gradient-to-br from-slate-800 via-slate-950 to-indigo-950 border-slate-400/25 shadow-slate-950/30' : 'bg-gradient-to-br from-orange-950 via-slate-950 to-rose-950 border-orange-400/30 shadow-orange-950/30'
                }`}>
                  <div className="absolute inset-0 bg-white/[0.03] pointer-events-none" />
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{index === 0 ? 'ðŸ¥‡' : index === 1 ? 'ðŸ¥ˆ' : 'ðŸ¥‰'}</span>
                    <span className="text-xs font-black bg-white/12 border border-white/15 px-3 py-1 rounded-full text-white">{entry.honorScore} Ä‘iá»ƒm</span>
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white truncate">{entry.studentName}</h3>
                  <p className="text-xs font-bold text-slate-300 mt-1">{entry.completedLessons} bÃ i â€¢ {entry.averageAccuracy}% Ä‘Ãºng â€¢ {entry.studyDays} ngÃ y há»c</p>
                  <p className="mt-3 text-[11px] font-black text-amber-100 bg-white/12 border border-white/15 rounded-xl px-3 py-2 inline-block">{entry.badges[0]}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl overflow-hidden" id="leaderboard-sheet">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="font-extrabold text-slate-100 text-base">{leaderboardTitleMap[leaderboardCategory]} ({leaderboardRows.length})</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Äiá»ƒm = BÃ i x50 + Tá»· lá»‡ Ä‘Ãºng x3 + NgÃ y há»c x20 + Tiáº¿n bá»™</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 mt-4">
                <table className="w-full text-left border-collapse" id="leaderboard-table">
                  <thead>
                    <tr className="bg-slate-900 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">
                      <th className="p-4">STT</th>
                      <th className="p-4">Há»c sinh</th>
                      <th className="p-4 text-center">BÃ i hoÃ n thÃ nh</th>
                      <th className="p-4 text-center">CÃ¢u Ä‘Ãºng</th>
                      <th className="p-4 text-center">CÃ¢u sai</th>
                      <th className="p-4 text-center">Tá»· lá»‡ Ä‘Ãºng</th>
                      <th className="p-4 text-center">Sá»‘ ngÃ y há»c</th>
                      <th className="p-4 text-center">Äiá»ƒm vinh danh</th>
                      <th className="p-4">Huy hiá»‡u</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {leaderboardRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-400 text-sm font-medium">
                          ChÆ°a cÃ³ dá»¯ liá»‡u phÃ¹ há»£p Ä‘á»ƒ láº­p báº£ng vinh danh.
                        </td>
                      </tr>
                    ) : (
                      leaderboardRows.map((entry, index) => (
                        <tr key={`${entry.studentKey || entry.studentName}-${index}`} className="hover:bg-white/5 text-sm font-semibold text-slate-200">
                          <td className="p-4 text-slate-400 text-xs font-bold">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/20 flex items-center justify-center font-bold text-xs">
                                {entry.studentName.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <strong className="text-slate-100 font-bold">{entry.studentName}</strong>
                                {entry.className && <p className="text-[10px] text-slate-400">{entry.className}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">{entry.completedLessons}</td>
                          <td className="p-4 text-center text-emerald-300 font-bold">{entry.correctAnswers}</td>
                          <td className="p-4 text-center text-rose-300 font-bold">{entry.incorrectAnswers}</td>
                          <td className="p-4 text-center font-black text-sky-300">{entry.averageAccuracy}%</td>
                          <td className="p-4 text-center">{entry.studyDays}</td>
                          <td className="p-4 text-center">
                            <span className="px-3 py-1.5 rounded-full text-xs font-black bg-amber-300/15 text-amber-200 border border-amber-300/20">{entry.honorScore}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {entry.badges.map(badge => (
                                <span key={badge} className="text-[10px] font-black bg-indigo-400/15 text-indigo-200 border border-indigo-300/15 px-2 py-1 rounded-full">
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
              <h2 className="text-2xl font-black text-gray-800">Quáº£n lÃ½ TÃ i khoáº£n ngÆ°á»i dÃ¹ng</h2>
              <p className="text-gray-400 text-sm">Xem danh sÃ¡ch, tÃ¬m kiáº¿m, phÃ¢n quyá»n vai trÃ² (Role) vÃ  kÃ­ch hoáº¡t/khoÃ¡ (Lock) tÃ i khoáº£n há»c sinh, giÃ¡o viÃªn.</p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="TÃ¬m theo tÃªn, email, sá»‘ Ä‘iá»‡n thoáº¡i..."
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
                    <option value="">Táº¥t cáº£ vai trÃ²</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="teacher">GiÃ¡o viÃªn (Teacher)</option>
                    <option value="student">Há»c sinh (Student)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersStatusFilter}
                    onChange={(e) => setUsersStatusFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
                    <option value="active">Äang hoáº¡t Ä‘á»™ng</option>
                    <option value="blocked">ÄÃ£ khÃ³a</option>
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
                      <th className="p-4">TÃªn hiá»ƒn thá»‹</th>
                      <th className="p-4">LiÃªn há»‡ (Email / SÄT)</th>
                      <th className="p-4">ID tÃ i khoáº£n</th>
                      <th className="p-4 text-center">Vai trÃ²</th>
                      <th className="p-4 text-center">Tráº¡ng thÃ¡i</th>
                      <th className="p-4 text-center">HÃ nh Ä‘á»™ng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-400 text-sm font-medium">
                          KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n ngÆ°á»i dÃ¹ng nÃ o khá»›p vá»›i bá»™ lá»c.
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
                              <strong className="text-gray-800 font-bold">{u.name || 'ChÆ°a Ä‘áº·t tÃªn'}</strong>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-600 font-medium">{u.email || 'KhÃ´ng cÃ³ email'}</span>
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
                              <option value="student">Há»c sinh (Student)</option>
                              <option value="teacher">GiÃ¡o viÃªn (Teacher)</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              u.status === 'blocked' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {u.status === 'blocked' ? 'ÄÃ£ khÃ³a' : 'Hoáº¡t Ä‘á»™ng'}
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
                                title={u.status === 'blocked' ? 'Má»Ÿ khÃ³a tÃ i khoáº£n' : 'KhÃ³a tÃ i khoáº£n'}
                              >
                                {u.status === 'blocked' ? <Unlock size={14} /> : <Lock size={14} />}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Báº£n thÃ¢n</span>
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
              <h2 className="text-2xl font-black text-gray-800">Nháº­t kÃ½ há»‡ thá»‘ng (Audit Logs)</h2>
              <p className="text-gray-400 text-sm">Ghi chÃ©p cÃ¡c sá»± kiá»‡n quan trá»ng trong há»‡ thá»‘ng: Ä‘Äƒng kÃ½ má»›i, cáº­p nháº­t vai trÃ², khÃ³a/má»Ÿ khÃ³a tÃ i khoáº£n.</p>
            </div>

            {/* Logs Timeline Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 w-16">STT</th>
                      <th className="p-4 w-48">Thá»i gian</th>
                      <th className="p-4 w-40">HÃ nh Ä‘á»™ng</th>
                      <th className="p-4 w-52">NgÆ°á»i thá»±c hiá»‡n</th>
                      <th className="p-4">Chi tiáº¿t hÃ nh Ä‘á»™ng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-gray-400 text-sm font-medium">
                          ChÆ°a cÃ³ nháº­t kÃ½ hoáº¡t Ä‘á»™ng nÃ o Ä‘Æ°á»£c ghi nháº­n.
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
                                <span className="text-gray-800 font-bold">{log.userName || 'Há»‡ thá»‘ng'}</span>
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


