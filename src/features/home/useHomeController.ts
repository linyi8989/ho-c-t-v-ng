import React from 'react';
import type { Assignment, Class, GrammarSet, VocabSet } from '../../types';
import type { LeaderboardEntry, LeaderboardPeriod } from '../../lib/leaderboard';
import {
  filterPublicGrammarSets,
  filterPublicVocabSets,
  getGrammarGradeOptions,
  getHomeGradeOptions,
} from './homeSearch';

interface UseHomeControllerOptions {
  enabled: boolean;
  loading: boolean;
  token: string | null;
}

export function useHomeController({ enabled, loading, token }: UseHomeControllerOptions) {
  const [vocabSets, setVocabSets] = React.useState<VocabSet[]>([]);
  const [grammarSets, setGrammarSets] = React.useState<GrammarSet[]>([]);
  const [listeningSets, setListeningSets] = React.useState<Array<{ level?: string }>>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [, setAssignments] = React.useState<Assignment[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = React.useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [search, setSearch] = React.useState('');
  const [grade, setGrade] = React.useState('');
  const [grammarSearch, setGrammarSearch] = React.useState('');
  const [grammarGrade, setGrammarGrade] = React.useState('');
  const [leaderboardPeriod, setLeaderboardPeriod] = React.useState<LeaderboardPeriod>('week');
  const homeDataRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    if (loading || !enabled) return;

    const controller = new AbortController();
    const requestId = ++homeDataRequestIdRef.current;
    const requestToken = token;
    const isCurrent = () => (
      !controller.signal.aborted && homeDataRequestIdRef.current === requestId
    );
    const isAbortError = (error: unknown) => (
      controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
    );
    const loadJson = async (url: string) => {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: requestToken ? { Authorization: `Bearer ${requestToken}` } : undefined,
      });
      if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`);
      return response.json();
    };

    const loadGuestHome = async () => {
      if (isCurrent()) {
        setClasses([]);
        setAssignments([]);
      }
      const tasks = [
        loadJson('/api/public/vocab-sets')
          .then(data => { if (isCurrent()) setVocabSets(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Public vocab API unreachable:', error); setVocabSets([]); } }),
        loadJson('/api/public/grammar-sets')
          .then(data => { if (isCurrent()) setGrammarSets(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Public grammar API unreachable:', error); setGrammarSets([]); } }),
        loadJson('/api/listening/sets')
          .then(data => { if (isCurrent()) setListeningSets(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Public listening API unreachable:', error); setListeningSets([]); } }),
      ];
      await Promise.allSettled(tasks);
    };

    const loadAuthenticatedHome = async () => {
      const tasks = [
        loadJson('/api/grammar-sets')
          .then(data => { if (isCurrent()) setGrammarSets(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Grammar API unreachable:', error); setGrammarSets([]); } }),
        loadJson('/api/listening/sets')
          .then(data => { if (isCurrent()) setListeningSets(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Listening API unreachable:', error); setListeningSets([]); } }),
        loadJson('/api/vocab-sets')
          .then(data => { if (isCurrent()) setVocabSets(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Vocab API unreachable:', error); setVocabSets([]); } }),
        loadJson('/api/assignments')
          .then(data => { if (isCurrent()) setAssignments(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Assignments API unreachable:', error); setAssignments([]); } }),
        loadJson('/api/classes')
          .then(data => { if (isCurrent()) setClasses(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Classes API unreachable:', error); setClasses([]); } }),
      ];
      await Promise.allSettled(tasks);
    };

    void (requestToken ? loadAuthenticatedHome() : loadGuestHome());
    return () => {
      controller.abort();
      if (homeDataRequestIdRef.current === requestId) homeDataRequestIdRef.current += 1;
    };
  }, [enabled, loading, token]);

  React.useEffect(() => {
    if (loading || !enabled) return;
    const controller = new AbortController();
    setLeaderboardStatus('loading');
    fetch(`/api/public/leaderboard-summary?period=${leaderboardPeriod}&limit=5`, {
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Leaderboard failed with HTTP ${response.status}`);
        setLeaderboard(Array.isArray(data.entries) ? data.entries : []);
        setLeaderboardStatus('ready');
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.warn('Leaderboard summary unavailable:', error);
        setLeaderboard([]);
        setLeaderboardStatus('unavailable');
      });
    return () => controller.abort();
  }, [enabled, leaderboardPeriod, loading]);

  const gradeOptions = React.useMemo(
    () => getHomeGradeOptions(classes, vocabSets, listeningSets),
    [classes, listeningSets, vocabSets],
  );
  const grammarGradeOptions = React.useMemo(
    () => getGrammarGradeOptions(classes, grammarSets),
    [classes, grammarSets],
  );
  const filteredVocabSets = React.useMemo(
    () => filterPublicVocabSets(vocabSets, search, grade),
    [grade, search, vocabSets],
  );
  const filteredGrammarSets = React.useMemo(
    () => filterPublicGrammarSets(grammarSets, grammarSearch, grammarGrade),
    [grammarGrade, grammarSearch, grammarSets],
  );

  return {
    filteredGrammarSets,
    filteredVocabSets,
    grade,
    gradeOptions,
    grammarGrade,
    grammarGradeOptions,
    grammarSearch,
    leaderboard,
    leaderboardPeriod,
    leaderboardStatus,
    search,
    setGrade,
    setGrammarGrade,
    setGrammarSearch,
    setLeaderboardPeriod,
    setSearch,
  };
}
