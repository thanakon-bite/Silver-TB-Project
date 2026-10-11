import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Send, UserRound } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errorMessage';
import { baht, localDateTime } from '../../lib/format';
import { primaryButtonInline, secondaryButton } from '../ui/buttonStyles';

interface LineStatus {
  configured: boolean;
  webhook_secret_set: boolean;
  source: 'env' | 'none';
  /** The env-named recipients, masked. */
  targets: string[];
  /** How many LINE Recipients the Admins ticked. */
  recipients?: number;
}

/** A friend of the Official Account (CONTEXT.md: LINE Recipient once ticked). */
interface LineFriend {
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  followed_at: string;
  receives_alerts: boolean;
}

interface PaymentEvent {
  id: string;
  type: string;
  result: string | null;
  /** In the currency's smallest unit (satang), as Stripe sends it. */
  amount: number | null;
  currency: string | null;
  created_at: string;
  order_id: string | null;
  orders: { order_number: string } | null;
}

/** What a Stripe event means for the shop, by its type. */
const EVENT_KIND: Record<string, string> = {
  'checkout.session.completed': 'paid',
  'checkout.session.async_payment_succeeded': 'paid',
  'payment_intent.succeeded': 'paid',
  'checkout.session.async_payment_failed': 'failed',
  'payment_intent.payment_failed': 'failed',
  'charge.refunded': 'refunded',
};
/** How each webhook result reads: fine, a repeat, or a problem the Admin should look at. */
const RESULT_TONE: Record<string, 'ok' | 'quiet' | 'problem'> = {
  paid: 'ok',
  marked_failed: 'ok',
  refunded: 'ok',
  partial_refund: 'problem',
  already_paid: 'quiet',
  ignored: 'quiet',
  not_paid_yet: 'quiet',
  amount_mismatch: 'problem',
  intent_mismatch: 'problem',
  order_not_found: 'problem',
  paid_after_cancel: 'problem',
  no_order_metadata: 'problem',
  no_payment_intent: 'problem',
};
const isRoutine = (e: PaymentEvent) => e.result === 'already_paid' || e.result === 'ignored';

/** The Stripe webhook's audit trail, as what happened to which order. Repeats wait behind "show all". */
const StripeEvents: React.FC<{ events: PaymentEvent[] }> = ({ events }) => {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const routine = events.filter(isRoutine).length;
  const shown = showAll ? events : events.filter((e) => !isRoutine(e));
  const money = (e: PaymentEvent) =>
    e.amount == null ? null : e.currency && e.currency !== 'thb' ? `${(e.amount / 100).toLocaleString()} ${e.currency.toUpperCase()}` : baht(e.amount / 100);

  return (
    <section aria-labelledby="stripe-events-title" className="rounded-2xl border border-line p-5">
      <h3 id="stripe-events-title" className="font-semibold text-ink">{t('admin.settings.stripe_events')}</h3>
      <p className="mb-3 text-xs text-muted">{t('admin.settings.stripe_events_hint')}</p>
      {events.length === 0 ? (
        <p className="rounded-lg bg-sunken p-3 text-sm text-muted">{t('admin.settings.no_events')}</p>
      ) : (
        <>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {shown.map((e) => {
              const kind = EVENT_KIND[e.type];
              const title = kind ? t(`admin.settings.event_${kind}`) : e.type;
              const tone = RESULT_TONE[e.result || ''] || 'problem';
              const number = e.orders?.order_number;
              return (
                <li key={e.id} aria-label={[title, number].filter(Boolean).join(' · ')} className="flex justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink">
                      {title}
                      {number && e.order_id && (
                        <>
                          {' · '}
                          <Link to={`/admin?order=${e.order_id}`} className="font-mono text-accent-strong underline-offset-4 hover:underline">
                            {number}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className={`text-xs ${tone === 'problem' ? 'font-medium text-danger' : tone === 'ok' ? 'text-success' : 'text-muted'}`}>
                      {t(`admin.settings.result_${e.result || 'unknown'}`, { defaultValue: e.result || '' })}
                    </div>
                    <div className="font-mono text-xs tabular-nums text-muted">{localDateTime(e.created_at, i18n.language)}</div>
                  </div>
                  {money(e) && <span className="shrink-0 font-mono tabular-nums text-ink">{money(e)}</span>}
                </li>
              );
            })}
          </ul>
          {routine > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
            >
              {showAll ? t('admin.settings.hide_routine') : t('admin.settings.show_all_events', { count: routine })}
            </button>
          )}
        </>
      )}
    </section>
  );
};

const Check: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <li className="flex items-center gap-2">
    {ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-danger" />}
    <span className={ok ? 'text-ink' : 'text-ink font-medium'}>{children}</span>
  </li>
);

/**
 * The Official Account's friends, each with a tick for order alerts. A tick saves at once and flips
 * back, with the reason under the list, when saving fails.
 */
const LineRecipients: React.FC<{ onChange: (count: number) => void }> = ({ onChange }) => {
  const { t, i18n } = useTranslation();
  const [friends, setFriends] = useState<LineFriend[] | null>(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);

  const load = useCallback(
    () =>
      api
        .get<{ contacts: LineFriend[] }>('/notifications/line/contacts')
        .then((r) => {
          setFriends(r.contacts);
          onChange(r.contacts.filter((f) => f.receives_alerts).length);
        })
        .catch((err) => {
          // Not an empty list: say it could not be read (e.g. migration 006 not run yet)
          setFriends([]);
          setError(t('admin.settings.friends_failed', { reason: errorMessage(err, t) }));
        }),
    // onChange is the parent's setter wrapper; reloading follows the language only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );
  useEffect(() => {
    load();
  }, [load]);

  /** Asks LINE for every follower, for when its webhook cannot reach the shop (e.g. a local machine). */
  const sync = async () => {
    setSyncing(true);
    setError('');
    setSynced(null);
    try {
      const r = await api.post<{ synced: number }>('/notifications/line/contacts/sync', {});
      setSynced(r.synced);
      await load();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setSyncing(false);
    }
  };

  const toggle = async (friend: LineFriend) => {
    const next = !friend.receives_alerts;
    const set = (value: boolean) =>
      setFriends((list) => {
        const updated = (list || []).map((f) => (f.line_user_id === friend.line_user_id ? { ...f, receives_alerts: value } : f));
        onChange(updated.filter((f) => f.receives_alerts).length);
        return updated;
      });
    setError('');
    set(next);
    try {
      await api.patch(`/notifications/line/contacts/${friend.line_user_id}`, { receives_alerts: next });
    } catch (err) {
      set(!next);
      setError(errorMessage(err, t));
    }
  };

  if (!friends) return <p className="text-sm text-muted">{t('loading')}</p>;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{t('admin.settings.recipients_title')}</legend>
      {friends.length === 0 && error ? null : friends.length === 0 ? (
        <p className="text-sm text-muted bg-sunken rounded-lg p-3">{t('admin.settings.no_friends')}</p>
      ) : (
        <>
          <p className="text-xs text-muted">{t('admin.settings.recipients_hint')}</p>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {friends.map((f) => (
              <li key={f.line_user_id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.receives_alerts}
                    onChange={() => toggle(f)}
                    className="h-4 w-4 accent-accent-strong"
                  />
                  {f.picture_url ? (
                    <img src={f.picture_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-muted">
                      <UserRound className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{f.display_name || t('admin.settings.unnamed_friend')}</span>
                    <span className="block text-xs text-muted">
                      {t('admin.settings.friend_since', { date: localDateTime(f.followed_at, i18n.language) })}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={sync} disabled={syncing} className={`${secondaryButton} w-auto`}>
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden />
          {t('admin.settings.sync_friends')}
        </button>
        {synced !== null && (
          <p aria-live="polite" className="text-sm text-muted">
            {t('admin.settings.synced', { count: synced })}
          </p>
        )}
      </div>
    </fieldset>
  );
};

const AdminSettings: React.FC = () => {
  const { t } = useTranslation();
  const [line, setLine] = useState<LineStatus | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<LineStatus>('/notifications/line/status').then(setLine).catch(() => setLine(null));
    api.get<PaymentEvent[]>('/admin/payments?limit=30').then(setEvents).catch(() => setEvents([]));
  }, []);

  const test = async () => {
    setSending(true);
    try {
      await api.post('/notifications/line/test', {});
      Swal.fire({ icon: 'success', title: t('admin.settings.test_sent'), text: t('admin.settings.check_line') });
    } catch (err: any) {
      Swal.fire(t('admin.settings.test_failed'), err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-line p-5 space-y-4">
        <h3 className="font-semibold text-ink">{t('admin.settings.line_title')}</h3>
        {!line ? (
          <p className="text-sm text-muted">{t('loading')}</p>
        ) : (
          <>
            <ul className="space-y-2 text-sm">
              <Check ok={line.configured}>{t('admin.settings.token_set')}</Check>
              <Check ok={line.webhook_secret_set}>{t('admin.settings.secret_set')}</Check>
              <Check ok={line.targets.length + (line.recipients ?? 0) > 0}>
                {line.targets.length > 0 && t('admin.settings.sending_to', { targets: line.targets.join(', ') })}
                {line.targets.length > 0 && (line.recipients ?? 0) > 0 && ' · '}
                {(line.recipients ?? 0) > 0 && t('admin.settings.picked_count', { count: line.recipients })}
                {line.targets.length + (line.recipients ?? 0) === 0 && t('admin.settings.no_recipient')}
              </Check>
            </ul>
            <LineRecipients onChange={(count) => setLine((l) => (l ? { ...l, recipients: count } : l))} />
            {line.targets.length === 0 && (
              <p className="text-sm text-muted bg-sunken rounded-lg p-3">
                {t('admin.settings.how_to_set')} <code className="text-xs">LINE_OWNER_USER_ID</code>
              </p>
            )}
            <button
              onClick={test}
              disabled={sending || !line.configured || line.targets.length + (line.recipients ?? 0) === 0}
              className={primaryButtonInline}
            >
              <Send className="w-4 h-4" /> {sending ? t('admin.settings.sending') : t('admin.settings.send_test')}
            </button>
          </>
        )}
      </div>

      <StripeEvents events={events} />
    </div>
  );
};

export default AdminSettings;
