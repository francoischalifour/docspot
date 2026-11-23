import { QuestionIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { cx } from '@/ui/cx';

type SuggestedQuestionsProps = {
  questions: string[];
  onChoose: (question: string) => void;
  className?: string;
  'aria-label'?: string;
};

export function SuggestedQuestions({
  questions,
  onChoose,
  className,
  'aria-label': ariaLabel,
}: SuggestedQuestionsProps) {
  return (
    <ul aria-label={ariaLabel} className={cx('docspot-suggestions', className)}>
      {questions.map(question => (
        <li key={question}>
          <button
            type="button"
            className="docspot-suggestion"
            onClick={() => onChoose(question)}
          >
            <span className="docspot-suggestion-icon">
              <SlotIcon name="ask" icon={QuestionIcon} />
            </span>
            <span>{question}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
