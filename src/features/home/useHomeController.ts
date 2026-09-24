import React from 'react';
import type { Assignment, Class, GameSession, GrammarSet, VocabSet } from '../../types';
import { buildLeaderboard, type LeaderboardPeriod } from '../../lib/leaderboard';
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
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [leaderboardResults, setLeaderboardResults] = React.useState<GameSession[]>([]);
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
        loadJson('/api/public/leaderboard-results')
          .then(data => { if (isCurrent()) setLeaderboardResults(Array.isArray(data) ? data : []); })
          .catch(async error => {
            if (isAbortError(error) || !isCurrent()) return;
            console.warn('Public leaderboard API unreachable; using bounded recent results:', error);
            try {
              const fallback = await loadJson('/api/public/results?limit=100');
              if (isCurrent()) setLeaderboardResults(Array.isArray(fallback) ? fallback : []);
            } catch (fallbackError) {
              if (!isAbortError(fallbackError) && isCurrent()) setLeaderboardResults([]);
            }
          }),
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
        loadJson('/api/leaderboard-results')
          .then(data => { if (isCurrent()) setLeaderboardResults(Array.isArray(data) ? data : []); })
          .catch(error => { if (!isAbortError(error) && isCurrent()) { console.warn('Leaderboard API unreachable:', error); setLeaderboardResults([]); } }),
      ];
      await Promise.allSettled(tasks);
    };

    void (requestToken ? loadAuthenticatedHome() : loadGuestHome());
    return () => {
      controller.abort();
      if (homeDataRequestIdRef.current === requestId) homeDataRequestIdRef.current += 1;
    };
  }, [enabled, loading, token]);

  const gradeOptions = React.useMemo(
    () => getHomeGradeOptions(classes, vocabSets, listeningSets),
    [classes, listeningSets, vocabSets],
  );
  const grammarGradeOptions = React.useMemo(
    () => getGrammarGradeOptions(classes, grammarSets),
    [classes, grammarSets],
  );
  const leaderboard = React.useMemo(
    () => buildLeaderboard(leaderboardResults, assignments, { period: leaderboardPeriod }).gold.slice(0, 5),
    [assignments, leaderboardPeriod, leaderboardResults],
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
    search,
    setGrade,
    setGrammarGrade,
    setGrammarSearch,
    setLeaderboardPeriod,
    setSearch,
  };
}
