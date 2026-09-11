import React, { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import type { GrammarSet, VocabSet } from '../../types';
import type { TeacherPreviewResource } from '../../appRoutes';
import StudentLearningArea from '../games/StudentLearningArea';
import GrammarLearningArea from '../grammar/GrammarLearningArea';

interface TeacherLibraryPreviewProps {
  resourceType: TeacherPreviewResource;
  setId: string;
  token: string;
  teacherName?: string;
  onBack: () => void;
}

type LoadedPreview =
  | { resourceType: 'vocabulary'; set: VocabSet }
  | { resourceType: 'grammar'; set: GrammarSet };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isExpectedPreview(value: unknown, resourceType: TeacherPreviewResource, setId: string) {
  if (!isRecord(value) || value.id !== setId) return false;
  return resourceType === 'vocabulary'
    ? Array.isArray(value.items)
    : Array.isArray(value.questions);
}

export default function TeacherLibraryPreview({
  resourceType,
  setId,
  token,
  teacherName,
  onBack,
}: TeacherLibraryPreviewProps) {
  const [loaded, setLoaded] = useState<LoadedPreview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setError('');

    if (!setId) {
      setError('Đường dẫn xem thử không hợp lệ.');
      return () => controller.abort();
    }

    const endpoint = resourceType === 'vocabulary'
      ? `/api/admin/vocab-sets/${encodeURIComponent(setId)}/preview`
      : `/api/admin/grammar-sets/${encodeURIComponent(setId)}/preview`;

    void fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }).then(async response => {
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : 'Không thể mở bài xem thử.';
        throw new Error(message);
      }
      if (!isExpectedPreview(payload, resourceType, setId)) {
        throw new Error('Dữ liệu bài xem thử không hợp lệ.');
      }
      setLoaded(resourceType === 'vocabulary'
        ? { resourceType, set: payload as unknown as VocabSet }
        : { resourceType, set: payload as unknown as GrammarSet });
    }).catch(reason => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Không thể mở bài xem thử.');
    });

    return () => controller.abort();
  }, [resourceType, setId, token]);

  if (error) {
    return (
      <main id="teacher-library-preview-error" className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto text-rose-600" size={42} aria-hidden="true" />
          <h1 className="mt-4 text-xl font-black text-slate-950">Không thể mở bài xem thử</h1>
          <p role="alert" className="mt-2 text-sm font-semibold text-slate-600">{error}</p>
          <button type="button" onClick={onBack} className="mt-6 rounded-xl border border-blue-700 bg-blue-700 px-5 py-3 font-black text-white">Quay lại quản trị</button>
        </section>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main id="teacher-library-preview-loading" className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div role="status" className="flex items-center gap-3 font-bold text-slate-700">
          <LoaderCircle className="animate-spin text-blue-700" size={24} aria-hidden="true" />
          Đang mở bài xem thử...
        </div>
      </main>
    );
  }

  if (loaded.resourceType === 'vocabulary') {
    return (
      <StudentLearningArea
        vocabSet={loaded.set}
        studentName={teacherName?.trim() || 'Giáo viên (Học thử)'}
        onBack={onBack}
      />
    );
  }

  return <GrammarLearningArea grammarSet={loaded.set} onBack={onBack} />;
}
