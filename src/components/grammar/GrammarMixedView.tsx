import { grammarBlockLabel, grammarBlockPresentation, type GrammarMixedPresentation } from '../../lib/grammarBlocks';
import GrammarPassageView, { type PassageFeedback } from './GrammarPassageView';

interface Props {
  key?: string;
  attempt: GrammarMixedPresentation;
  selected: Record<string, string>;
  onChoice?: (questionId: string, optionId: string) => void;
  onBankChange?: (blockId: string, answers: Record<string, string>) => void;
  feedback?: Record<string, PassageFeedback>;
  disabled?: boolean;
  review?: boolean;
}

/** Only views are repeated; persistence, progress and submit belong to one run. */
export default function GrammarMixedView({ attempt, selected, onChoice, onBankChange, feedback, disabled, review }: Props) {
  let offset = 0;
  return <div className="grammar-mixed-exercise" data-grammar-mixed>
    {attempt.blocksSnapshot.map((block, index) => {
      const presentation = grammarBlockPresentation(attempt, block);
      const questionIds = new Set(presentation.questions.map(question => question.id));
      const blockSelected = Object.fromEntries(Object.entries(selected).filter(([id]) => questionIds.has(id)));
      const questionNumberOffset = offset;
      offset += presentation.questions.length;
      return <section key={block.id} className="grammar-mixed-block" data-grammar-block-id={block.id} data-grammar-block-type={block.type} aria-label={`Nhóm nội dung ${index + 1}: ${grammarBlockLabel(block.type)}`}>
        {block.title && <h3 className="grammar-mixed-block-title">{block.title}</h3>}
        <GrammarPassageView attempt={presentation} selected={blockSelected} feedback={feedback} disabled={disabled} review={review} questionNumberOffset={questionNumberOffset} onChoice={onChoice} onBankChange={answers => onBankChange?.(block.id, answers)} />
      </section>;
    })}
  </div>;
}
