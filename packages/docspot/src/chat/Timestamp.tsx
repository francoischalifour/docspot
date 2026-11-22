type TimestampProps = { time: string | undefined };

export function Timestamp({ time }: TimestampProps) {
  if (!time) return null;
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  const isToday = date.toDateString() === new Date().toDateString();
  const label = new Intl.DateTimeFormat(undefined, {
    ...(isToday ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return (
    <time
      dateTime={time}
      title={new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date)}
      className="docspot-timestamp"
    >
      {label}
    </time>
  );
}
