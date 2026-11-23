import { use } from 'react';

import { LanguageContext, getFormatLanguage } from '@/ui/LanguageContext';

type TimestampProps = { time: string | undefined };

export function Timestamp({ time }: TimestampProps) {
  const language = getFormatLanguage(use(LanguageContext));
  if (!time) return null;
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  const isToday = date.toDateString() === new Date().toDateString();
  const label = new Intl.DateTimeFormat(language, {
    ...(isToday ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return (
    <time
      dateTime={time}
      title={new Intl.DateTimeFormat(language, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date)}
      className="docspot-timestamp"
    >
      {label}
    </time>
  );
}
