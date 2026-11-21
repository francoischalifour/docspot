import type { DocspotPage } from '@/types';
import { QuestionIcon } from '@/ui/icons';
import { cx } from '@/ui/primitives';

/** The questions to offer for a page: its own, or the defaults. */
export function getPrompts(page: DocspotPage | undefined, prompts: string[]) {
  return page?.prompts?.length ? page.prompts : prompts;
}

export function Suggestions({
  questions,
  onChoose,
  className,
  'aria-label': ariaLabel,
}: {
  questions: string[];
  onChoose: (question: string) => void;
  className?: string;
  'aria-label'?: string;
}) {
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
              <QuestionIcon size={14} />
            </span>
            <span>{question}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** An empty conversation's heading and questions, right above the composer. */
export function Welcome({
  title,
  questions,
  onChoose,
  className,
}: {
  title: string;
  questions: string[];
  onChoose?: (question: string) => void;
  className?: string;
}) {
  return (
    <div className={cx('docspot-welcome', className)}>
      <h2 className="docspot-welcome-title">{title}</h2>
      {onChoose && questions.length > 0 && (
        <Suggestions questions={questions} onChoose={onChoose} />
      )}
    </div>
  );
}
