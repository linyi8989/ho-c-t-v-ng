import type { ExamQuestion, ExamQuestionResult } from '../types';
import '../reading-explanations.css';

/** Only the authorized result carries this private text; never read it from playable questions. */
export default function ReadingExplanation({ result, number, className = '' }: {
  key?: string;
  result?: ExamQuestionResult;
  number?: number;
  className?: string;
}) {
  if (!result?.explanation?.trim() || result.type === 'long-writing' || result.type === 'scene-draw') return null;
  return <aside data-exam-reading-explanation className={className} aria-label={number ? `Giải thích câu ${number}` : 'Giải thích đáp án'}>
    <p className="reading-explanation-label">Giải thích{number ? ` · Câu ${number}` : ''}</p>
    <p className="reading-explanation-text">{result.explanation}</p>
  </aside>;
}

export function ReadingExplanationList({ questions, results }: {
  questions: Array<Pick<ExamQuestion, 'id' | 'number' | 'displayNumber'>>;
  results?: ExamQuestionResult[];
}) {
  const byId = new Map(results?.map(result => [result.questionId, result]));
  const explained = questions.flatMap(question => {
    const result = byId.get(question.id);
    return result?.explanation?.trim() && result.type !== 'long-writing' && result.type !== 'scene-draw' ? [{ question, result }] : [];
  });
  if (!explained.length) return null;
  return <section data-reading-explanation-list aria-label="Giải thích đáp án">{explained.map(({ question, result }) => <ReadingExplanation key={question.id} result={result} number={question.displayNumber || question.number} />)}</section>;
}
