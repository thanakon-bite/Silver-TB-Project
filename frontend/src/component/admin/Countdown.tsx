import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import type { OrderDeadline } from '../../lib/types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Under this much time left the countdown turns to the warning colour. */
const WARN_BELOW: Record<OrderDeadline['kind'], number> = { payment: HOUR, auto_confirm: DAY };

/**
 * Milliseconds left until `at`, never below 0. Ticks every second in the last hour and every minute
 * before that; stops once the time has passed.
 */
export function useTimeLeft(at: string): number {
  const end = new Date(at).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const now = Math.max(0, end - Date.now());
    setLeft(now);
    if (now <= 0) return;
    // Over an hour out: wake every minute, or exactly when the last hour starts, whichever is sooner
    const delay = now > HOUR ? Math.min(MINUTE, now - HOUR) : SECOND;
    const timer = setTimeout(() => setLeft(Math.max(0, end - Date.now())), delay);
    return () => clearTimeout(timer);
  }, [end, left]);
  return left;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** One Order's deadline in the Admin list: time left to pay, or until it is Confirmed automatically. */
const Countdown: React.FC<{ deadline: OrderDeadline }> = ({ deadline }) => {
  const { t } = useTranslation();
  const left = useTimeLeft(deadline.at);

  if (left <= 0) {
    return <span className="mt-1 block text-xs text-muted">{t('admin.orders.countdown.processing')}</span>;
  }
  const time =
    left >= DAY
      ? t('admin.orders.countdown.days', { days: Math.floor(left / DAY), hours: Math.floor((left % DAY) / HOUR) })
      : left >= HOUR
        ? t('admin.orders.countdown.hours', { hours: Math.floor(left / HOUR), minutes: Math.floor((left % HOUR) / MINUTE) })
        : `${pad(Math.floor(left / MINUTE))}:${pad(Math.floor((left % MINUTE) / SECOND))}`;
  const warn = left < WARN_BELOW[deadline.kind];
  return (
    <span
      data-warning={warn || undefined}
      className={`mt-1 flex items-center gap-1 text-xs tabular-nums ${warn ? 'font-semibold text-danger' : 'text-muted'}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t(`admin.orders.countdown.${deadline.kind}`, { time })}
    </span>
  );
};

export default Countdown;
