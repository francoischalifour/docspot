import { cx } from '@/ui/cx';
import { SuggestedQuestions } from '@/ui/SuggestedQuestions';

type WelcomeProps = {
  title: string;
  questions: string[];
  onChoose: (question: string) => void;
  className?: string;
};

/** An empty conversation's heading and questions, right above the composer. */
export function Welcome({
  title,
  questions,
  onChoose,
  className,
}: WelcomeProps) {
  return (
    <div className={cx('docspot-welcome', className)}>
      <h2 className="docspot-welcome-title">{title}</h2>
      {questions.length > 0 && (
        <SuggestedQuestions questions={questions} onChoose={onChoose} />
      )}
    </div>
  );
}
